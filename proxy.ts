import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
    const { pathname } = req.nextUrl;

    const protectedRoutes = ['/dashboard', '/connect', '/chat', '/history'];
    const isProtected = protectedRoutes.some((r) => pathname.startsWith(r));

    if (isProtected && !req.auth) {
        return NextResponse.redirect(new URL('/login', req.url));
    }

    if (pathname === '/login' && req.auth) {
        return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    return NextResponse.next();
});

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
