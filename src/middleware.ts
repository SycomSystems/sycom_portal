// src/middleware.ts
import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const pathname = req.nextUrl.pathname

    // ── Mobilná appka: Bearer token → NextAuth cookie ─────────────────────
    // React Native odosiela Authorization: Bearer <jwt>
    // Prevedieme ho na cookie, ktorú getServerSession() vie prečítať
    if (pathname.startsWith('/api/')) {
      const authHeader = req.headers.get('authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const bearerToken = authHeader.slice(7)
        const requestHeaders = new Headers(req.headers)
        // HTTPS = __Secure- prefix; HTTP = bez prefixu
        // Pridáme oba aby to fungovalo v každom prípade
        const existing = requestHeaders.get('cookie') || ''
        const injected = [
          `__Secure-next-auth.session-token=${bearerToken}`,
          `next-auth.session-token=${bearerToken}`,
        ].join('; ')
        requestHeaders.set('cookie', existing ? `${existing}; ${injected}` : injected)
        return NextResponse.next({ request: { headers: requestHeaders } })
      }
      // API bez Bearer tokenu — route handler si overí autentifikáciu sám
      return NextResponse.next()
    }
    // ──────────────────────────────────────────────────────────────────────

    const token = req.nextauth.token
    const role = (token as any)?.role

    // Routes accessible by AGENT
    const agentAllowed = ['/admin/sklad', '/admin/reports', '/admin/kb']
    const isAgentAllowed = agentAllowed.some(p => pathname === p || pathname.startsWith(p + '/'))

    if (pathname.startsWith('/settings') && pathname !== '/settings/profile' && role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    if (pathname.startsWith('/admin') && role !== 'ADMIN' && !isAgentAllowed) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    if (isAgentAllowed && role !== 'ADMIN' && role !== 'AGENT') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    if (pathname.startsWith('/kb') && role !== 'ADMIN' && role !== 'AGENT') {
      return NextResponse.redirect(new URL('/tickets', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // API routes: vždy pustíme ďalej (Bearer token alebo route handler vráti 401)
        if (req.nextUrl.pathname.startsWith('/api/')) return true
        // Page routes: vyžadujeme prihlásenie
        return !!token
      },
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
    '/api/:path*',   // ← Bearer token injection pre mobilnú appku
  ],
}
