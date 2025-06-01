import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

export interface EmoticonResult {
  url: string;
  alt: string;
}

async function searchEmoticons(
  keyword: string,
  apiKey?: string
): Promise<EmoticonResult[]> {
  const safeKeyword = encodeURIComponent(keyword.trim());
  if (!safeKeyword) return [];

  const maxRetries = 3;
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
    
      const url = `https://fabiaoqing.com/search/search/keyword/${safeKeyword}`;
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0',
        }
      });

      console.log('Fetched HTML content:', response.data.substring(0, 500) + '...'); // Log first 500 chars
      const $ = cheerio.load(response.data);
      console.log('Parsed HTML structure:', $.html().substring(0, 500) + '...'); // Log parsed structure
      const emoticons: EmoticonResult[] = [];
    
      // Process images sequentially with delay to avoid rate limiting
      const images = $('.searchbqppdiv.tagbqppdiv img.bqppsearch').toArray();
      for (let i = 0; i < images.length; i++) {
        const element = images[i];
        const src = $(element).attr('data-original') || $(element).attr('src');
        const alt = $(element).attr('alt') || $(element).attr('title') || keyword;
        if (src && (src.startsWith('http') || src.startsWith('//'))) {
          try {
            // Add delay between requests (500ms)
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            const imageResponse = await axios.get(src, {
              responseType: 'arraybuffer',
              headers: {
                'Referer': 'https://fabiaoqing.com/',
                'User-Agent': 'Mozilla/5.0'
              },
              timeout: 3000
            });
            // Only use base64 for small images (<100KB)
            if (imageResponse.data.length < 1 * 1024) {
              const base64Image = Buffer.from(imageResponse.data, 'binary').toString('base64');
              const mimeType = imageResponse.headers['content-type'] || 'image/jpeg';
              emoticons.push({
                url: `data:${mimeType};base64,${base64Image}`,
                alt: alt
              });
            } else {
              // For larger images, use original URL with referer header
              emoticons.push({
                url: src,
                alt: alt
              });
            }
          } catch (error) {
            console.error(`Failed to download image ${src}:`, error);
            // Fallback to original URL if download fails
            emoticons.push({
              url: src,
              alt: alt
            });
          }
        }
      };

      return emoticons.slice(0, 3);
    } catch (error: any) {
      lastError = error;
      console.error(`Emoticon search attempt ${attempt} failed:`, error);
      
      // 如果是503错误且不是最后一次尝试，则等待后重试
      if (error.response?.status === 503 && attempt < maxRetries) {
        const waitTime = attempt * 1000; // 指数退避
        console.log(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      break;
    }
  }

  // 如果所有尝试都失败，尝试让AI生成替代文本并重试
  if (apiKey) {
    const maxAlternativeAttempts = 3;
    let currentAlternative = keyword;
    
    for (let attempt = 1; attempt <= maxAlternativeAttempts; attempt++) {
      try {
        const prompt = `请为表情搜索提供"${currentAlternative}"的替代关键词，只需返回最相关的1-2个词，不要解释。例如："疯狂翻冰箱"→"找吃的"`;
        const response = await axios.post(DEEPSEEK_API_URL, {
          model: 'deepseek-chat',
          messages: [{
            role: 'user',
            content: prompt
          }],
          temperature: 0.3,
          max_tokens: 20
        }, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        const alternative = response.data.choices[0]?.message?.content?.trim();
        if (alternative && alternative !== currentAlternative) {
          console.log(`AI suggested alternative (attempt ${attempt}): "${currentAlternative}" → "${alternative}"`);
          
          // 尝试用新关键词搜索
          const emoticons = await searchEmoticons(alternative, apiKey);
          if (emoticons.length > 0) {
            return emoticons;
          }
          
          // 如果没找到，准备下一次尝试
          currentAlternative = alternative;
        }
      } catch (error) {
        console.error('Failed to get alternative from AI:', error);
        break;
      }
    }
  }

  console.error('All emoticon search attempts failed:', lastError);
  return [];
}

interface EmoticonReplacement {
  processedText: string;
  emoticons: EmoticonResult[];
}

async function replaceEmoticonTags(content: string, apiKey?: string): Promise<EmoticonReplacement> {
  // Enhanced pattern matching with full Chinese/English bracket support
  const emoticonRegex = /(?:[(\[]|（|【)([^)\]}】]+?\.(?:jpe?g|png|gif|webp))(?:[)\]]|）|】)/g;
  let result = content;
  const emoticons: EmoticonResult[] = [];
  
  const matches = [...content.matchAll(emoticonRegex)];
  console.log('Found potential emoticon matches:', matches);
  
  for (const match of matches) {
    try {
      const fullMatch = match[0];
      const fileName = match[1];
      
      // Extract and clean keyword from filename
      let keyword = fileName
        .split('.')[0] // Remove extension
        .replace(/[^\w\u4e00-\u9fa5\s]/g, '') // Keep Chinese, letters, numbers and spaces
        .trim();
      
      if (!keyword) {
        console.log(`No valid keyword extracted from ${fileName}`);
        continue;
      }

      // Generate keyword variations with progressive shortening
      const keywordVariations: string[] = [];
      const fullText = keyword;
      
      // 1. Full cleaned keyword
      if (fullText.length > 0) {
        keywordVariations.push(fullText);
      }
      
      // 2. Remove version numbers (e.g. "2.0版")
      const noVersion = fullText.replace(/[0-9.]+版/g, '').trim();
      if (noVersion.length > 0 && noVersion !== fullText) {
        keywordVariations.push(noVersion);
      }
      
      // 3. Generate all possible substrings from longest to shortest
      const minLength = 2; // Minimum 2 characters
      const maxLength = Math.min(fullText.length, 6); // Max 6 characters for efficiency
      
      // Generate substrings from longest to shortest
      for (let len = maxLength; len >= minLength; len--) {
        for (let i = 0; i <= fullText.length - len; i++) {
          const segment = fullText.substr(i, len);
          if (segment.length >= minLength) {
            keywordVariations.push(segment);
          }
        }
      }
      
      // 4. Remove duplicates while preserving order
      const uniqueVariations = [];
      const seen = new Set();
      for (const variation of keywordVariations) {
        if (variation && !seen.has(variation)) {
          seen.add(variation);
          uniqueVariations.push(variation);
        }
      }
      
      console.log('Generated keyword variations:', uniqueVariations);
      
      console.log(`Processing emoticon: ${fullMatch}, Keyword variations:`, keywordVariations);
      
      let bestMatch: EmoticonResult | null = null;
      
      // Try each keyword variation until we find a match
      for (const variation of keywordVariations) {
        const emoticons = await searchEmoticons(variation, apiKey);
        console.log(`Search results for "${variation}":`, emoticons.length);
        
        if (emoticons.length > 0) {
          bestMatch = emoticons[0];
          break;
        }
      }
      
      if (bestMatch?.url) {
        // 统一使用HTML img标签，确保base64和URL图片都能正确显示
        const escapedAlt = bestMatch.alt.replace(/"/g, '"');
        const imgTag = `<img src="${bestMatch.url}" alt="${escapedAlt}" style="max-width: 200px; max-height: 200px;" />`;
        result = result.replace(fullMatch, imgTag);
        console.log(`Replaced ${fullMatch} with: ${imgTag.substring(0, 100)}...`);
      } else {
        console.log(`No matching emoticon found for ${fullMatch}`);
      }
    } catch (error) {
      console.error(`Error processing emoticon match ${match[0]}:`, error);
    }
  }
  
  console.log('Final content after emoticon processing:', {
    text: result,
    emoticons: emoticons
  });
  return {
    processedText: result,
    emoticons: emoticons
  };
}
// Validate and parse guest limit
const GUEST_LIMIT = Math.max(1, parseInt(process.env.GUEST_LIMIT || '3'));
if (isNaN(GUEST_LIMIT)) {
  throw new Error('Invalid GUEST_LIMIT value in environment variables');
}

// Thread-safe rate limiting store
const ipRequestCounts = new Map<string, { count: number, lastReset: number }>();
const requestLock = new Map<string, boolean>();

export async function POST(req: Request) {
  try {
    const { message, history, apiKey, systemPrompt } = await req.json();
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';

    // Reset counters if it's a new day
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    if (!ipRequestCounts.has(clientIp) || now - ipRequestCounts.get(clientIp)!.lastReset > oneDay) {
      ipRequestCounts.set(clientIp, { count: 0, lastReset: now });
    }

    // Check rate limit for guests (no API key provided)
    if (!apiKey) {
      // Ensure thread-safe counting
      while (requestLock.get(clientIp)) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      requestLock.set(clientIp, true);
      
      try {
        const ipData = ipRequestCounts.get(clientIp)!;
        if (ipData.count >= GUEST_LIMIT) {
          const limitMessage = `The current preview experience limit has been reached (${GUEST_LIMIT} requests/day). If you continue to ask questions, please set APIKEY`;
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
        ipRequestCounts.set(clientIp, { 
          ...ipData, 
          count: ipData.count + 1 
        });
      } finally {
        requestLock.set(clientIp, false);
      }
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
    
    // Add system prompt if provided
    if (systemPrompt) {
      // Handle both string and array format system prompts
      let formattedPrompt;
      if (Array.isArray(systemPrompt)) {
        console.log('Received array system prompt:', systemPrompt);
        formattedPrompt = systemPrompt.join('\n');
      } else {
        console.log('Received string system prompt:', systemPrompt);
        formattedPrompt = String(systemPrompt).replace(/\n/g, '\n');
      }
      console.log('Formatted system prompt:', formattedPrompt);
      messages.push({
        role: 'system',
        content: formattedPrompt
      });
    }

    console.log('Final messages being sent to API:', {
      messages: messages.map(m => ({
        role: m.role,
        content: m.content.substring(0, 100) + (m.content.length > 100 ? '...' : '')
      })),
      messageCount: messages.length
    });
    
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

    // Add current user message (with emoticon processing)
    const { processedText } = await replaceEmoticonTags(String(message), apiKey);
    messages.push({
      role: 'user', 
      content: processedText
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

    // Process AI response for emoticons
    const aiResponse = data.choices[0].message.content;
    const { processedText: processedResponseText, emoticons } = await replaceEmoticonTags(aiResponse, effectiveApiKey);
    console.log('AI response after emoticon processing:', {
      text: processedResponseText,
      emoticons: emoticons.map(e => ({...e, url: e.url.substring(0, 50) + '...'}))
    });

    return NextResponse.json({
      ...data,
      content: {
        text: processedResponseText,
        emoticons: emoticons
      },
      response: processedResponseText, // 保持向后兼容
      emoticons: emoticons    // 保持向后兼容
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
