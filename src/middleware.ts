// src/middleware.ts
import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token    = req.nextauth.token
    const pathname = req.nextUrl.pathname
    const role     = (token as any)?.role

    // Admin-only routes
    if (pathname.startsWith('/admin') && role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // Agent + Admin routes (reports, team management)
    if (pathname.startsWith('/admin/reports') && role === 'CLIENT') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    if (pathname.startsWith('/admin/reports') && role === 'CLIENT_MANAGER') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // Knowledge base — staff only (ADMIN and AGENT)
    if (pathname.startsWith('/kb') && role !== 'ADMIN' && role !== 'AGENT') {
      return NextResponse.redirect(new URL('/tickets', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/tickets/:path*',
    '/kb/:path*',
    '/admin/:path*',
    '/settings/:path*',
    '/api/tickets/:path*',
    '/api/users/:path*',
    '/api/reports/:path*',
    '/api/kb/:path*',
    '/api/clients/:path*',
    '/api/teams/:path*',
    '/api/comments/:path*',
    '/api/settings/:path*',
  ],
}
