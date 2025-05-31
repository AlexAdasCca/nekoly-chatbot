import { NextResponse } from 'next/server';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const GUEST_LIMIT = parseInt(process.env.GUEST_LIMIT || '3');

// Simple in-memory store for rate limiting (replace with Redis in production)
const ipRequestCounts = new Map<string, { count: number, lastReset: number }>();

export async function POST(req: Request) {
  try {
    const { message, history, apiKey } = await req.json();
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';

    // Reset counters if it's a new day
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    if (!ipRequestCounts.has(clientIp) || now - ipRequestCounts.get(clientIp)!.lastReset > oneDay) {
      ipRequestCounts.set(clientIp, { count: 0, lastReset: now });
    }

    // Check rate limit for guests (no API key provided)
    if (!apiKey) {
      const ipData = ipRequestCounts.get(clientIp)!;
      if (ipData.count >= GUEST_LIMIT) {
        const limitMessage = "The current preview experience limit has been reached. If you continue to ask questions, please set APIKEY";
        return NextResponse.json({
          choices: [{
            message: {
              role: "assistant",
              content: limitMessage
            }
          }],
          response: limitMessage
        });
      }
      ipData.count += 1;
    }

    // Use provided API key or fallback to server key
    const effectiveApiKey = apiKey || DEEPSEEK_API_KEY;
    if (!effectiveApiKey) {
      return NextResponse.json(
        { error: 'No API key provided and server key not configured' },
        { status: 401 }
      );
    }

    // Validate and format messages array
    const messages = [];
    
    // Add history messages if they exist and are valid
    if (Array.isArray(history)) {
      for (const msg of history) {
        if (msg?.role && msg?.content) {
          messages.push({
            role: msg.role,
            content: String(msg.content)
          });
        }
      }
    }

    // Add current user message
    messages.push({
      role: 'user',
      content: String(message)
    });

    // Create request body with proper encoding
    const requestBody = {
      model: 'deepseek-chat',
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000,
    };

    // Convert to Buffer to ensure proper encoding
    const bodyBuffer = Buffer.from(JSON.stringify(requestBody), 'utf-8');

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${effectiveApiKey}`,
      },
      body: bodyBuffer,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('DeepSeek API Error:', data);
      return NextResponse.json(
        { error: data.error?.message || 'Failed to get response from DeepSeek API' },
        { status: 500 }
      );
    }

    if (!data.choices?.[0]?.message?.content) {
      return NextResponse.json(
        { error: 'Invalid response format from DeepSeek API' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ...data,
      response: data.choices[0].message.content
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
