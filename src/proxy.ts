import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { rateLimit } from '@/lib/rateLimit';

export function proxy(req: NextRequest) {
  // Only apply to /api routes
  if (!req.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || '127.0.0.1';
  
  // Rate Limiting
  let limitResult;
  if (req.nextUrl.pathname.startsWith('/api/auth/login')) {
    // 5 attempts per 15 minutes for login
    limitResult = rateLimit(`login_${ip}`, 5, 15 * 60 * 1000);
  } else {
    // 100 requests per minute for other APIs
    // Use session ID if available, otherwise IP
    const sessionCookie = req.cookies.get('session');
    const identifier = sessionCookie ? `user_${sessionCookie.value.substring(0, 20)}` : `ip_${ip}`;
    limitResult = rateLimit(`api_${identifier}`, 100, 60 * 1000);
  }

  if (!limitResult.success) {
    return new NextResponse(
      JSON.stringify({ error: 'Too many requests, please try again later.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // CSRF Protection for state-mutating requests (POST, PUT, DELETE)
  // Skip CSRF for login, as they don't have a session/token yet.
  if (['POST', 'PUT', 'DELETE'].includes(req.method) && req.nextUrl.pathname !== '/api/auth/login') {
    const csrfHeader = req.headers.get('X-CSRF-Token');
    const csrfCookie = req.cookies.get('csrf_token')?.value;

    if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
      return new NextResponse(
        JSON.stringify({ error: 'CSRF token missing or invalid' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
