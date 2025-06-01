import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');
  
  if (!imageUrl) {
    return new Response('Missing image URL', { status: 400 });
  }

  try {
    const res = await fetch(imageUrl, {
      headers: {
        'Referer': 'https://fabiaoqing.com/',
        'User-Agent': 'Mozilla/5.0'
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch image: ${res.statusText}`);
    }

    const imageBuffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/*';

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400'
      }
    });
  } catch (error) {
    console.error('Image proxy error:', error);
    return new Response('Failed to proxy image', { status: 500 });
  }
}
