// src/middleware.ts
import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname
    const role = (token as any)?.role

    // Routes accessible by AGENT (not ADMIN-only)
    const agentAllowed = [
      '/admin/sklad',
      '/admin/reports',
    ]
    const isAgentAllowed = agentAllowed.some(p => pathname === p || pathname.startsWith(p + '/'))

    // Admin-only routes (block non-ADMIN unless explicitly agent-allowed)
    if (pathname.startsWith('/admin') && role !== 'ADMIN' && !isAgentAllowed) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // Agent-allowed admin routes: block CLIENT roles
    if (isAgentAllowed && role !== 'ADMIN' && role !== 'AGENT') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // Knowledge base — staff only
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
    '/api/stock/:path*',
    '/api/vykaz/:path*',
    '/api/manual-hours/:path*',
  ],
}
