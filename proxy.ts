import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const protectedRoutes = [
  '/dashboard',
  '/projects',
  '/boq',
  '/materials',
  '/production',
  '/fat',
  '/delivery',
  '/site-work',
  '/finance',
  '/reports',
  '/actions',
  '/settings',
];

export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== 'production' && process.env.DEMO_MODE === 'true')
    return NextResponse.next();

  const cookieName =
    process.env.SESSION_COOKIE_NAME ||
    (process.env.NODE_ENV === 'production'
      ? '__Host-pcc_session'
      : 'pcc_session');
  const hasSessionCookie = request.cookies.has(cookieName);
  const isProtected = protectedRoutes.some(
    (route) =>
      request.nextUrl.pathname === route ||
      request.nextUrl.pathname.startsWith(`${route}/`),
  );

  if (isProtected && !hasSessionCookie)
    return NextResponse.redirect(new URL('/login', request.url));
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/login',
    '/dashboard/:path*',
    '/projects/:path*',
    '/boq/:path*',
    '/materials/:path*',
    '/production/:path*',
    '/fat/:path*',
    '/delivery/:path*',
    '/site-work/:path*',
    '/finance/:path*',
    '/reports/:path*',
    '/actions/:path*',
    '/settings/:path*',
  ],
};
