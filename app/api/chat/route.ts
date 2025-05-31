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
        return NextResponse.json({
          response: 'The current preview experience limit has been reached. If you continue to ask questions, please set APIKEY'
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

    const messages = [
      ...history,
      { role: 'user', content: message }
    ];

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${effectiveApiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
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
      response: data.choices[0].message.content,
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
