// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Allow unauthenticated access to login, auth APIs, and static assets
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt'
  ) {
    return NextResponse.next();
  }

  // Check session cookie
  const authed = req.cookies.get('inv_auth')?.value === '1';
  if (authed) return NextResponse.next();

  // Redirect to login with ?next=
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', pathname + (search || ''));
  return NextResponse.redirect(url);
}

// Run on everything except static assets (alternative to the if-check)
export const config = {
  matcher: [
    // exclude _next/static, _next/image, favicon, robots
    '/((?!_next/static|_next/image|favicon.ico|robots.txt).*)',
  ],
};
