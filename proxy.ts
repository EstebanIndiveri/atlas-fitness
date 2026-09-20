import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth/session';

/**
 * Next.js proxy for server-side authentication and routing
 * 
 * Protected routes: /dashboard
 * Auth-only routes: /login, /register (redirect to /dashboard if authenticated)
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Get session from cookies
  const cookieHeader = request.headers.get('cookie');
  const session = getSessionFromCookies(cookieHeader);

  // Protected routes - require authentication
  if (pathname.startsWith('/dashboard')) {
    if (!session || !session.userId) {
      // Not authenticated, redirect to login
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    // Authenticated - set x-user-id header and allow
    const response = NextResponse.next();
    response.headers.set('x-user-id', session.userId.toString());
    return response;
  }

  // Auth pages - redirect to dashboard if already authenticated
  if (pathname === '/login' || pathname === '/register') {
    if (session && session.userId) {
      // Already authenticated, redirect to the golden-path home
      const dashboardUrl = new URL('/dashboard/today', request.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/login',
    '/register',
  ],
};
