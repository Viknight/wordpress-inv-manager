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
    pathname === '/robots.txt' ||
    /\.(?:png|jpe?g|gif|svg|webp|ico|woff2?|ttf|otf)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Simple cookie-based auth check
  const authed = req.cookies.get('inv_auth')?.value === '1';
  if (!authed) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname + (search || ''));
    return NextResponse.redirect(url);
  }

  // CSRF: require x-csrf-token on non-GET API calls (except /api/auth/*)
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth') && req.method !== 'GET') {
    const hdr = req.headers.get('x-csrf-token');
    const cookie = req.cookies.get('csrf_token')?.value;
    if (!hdr || !cookie || hdr !== cookie) {
      return NextResponse.json({ ok: false, error: 'CSRF' }, { status: 403 });
    }
  }

  return NextResponse.next();
}

// Run middleware on everything; early returns above skip assets
export const config = { matcher: ['/:path*'] };
