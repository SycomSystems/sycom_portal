// src/lib/mobile-session.ts
// Používaj getMobileSession() namiesto getServerSession(authOptions) v API routes
// ktoré musia fungovať aj pre mobilnú appku (Bearer token)
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { decode } from 'next-auth/jwt'
import { headers } from 'next/headers'

export async function getMobileSession() {
  // 1. Skús štandardný NextAuth session (web browser s cookies)
  const session = await getServerSession(authOptions)
  if (session) return session

  // 2. Fallback: Bearer token z Authorization hlavičky (mobilná appka)
  const headersList = headers()
  const auth = headersList.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null

  try {
    const decoded = await decode({
      token: auth.slice(7),
      secret: process.env.NEXTAUTH_SECRET!,
    })
    if (!decoded) return null

    // Vrátime objekt kompatibilný so session z getServerSession()
    return {
      user: {
        id:    (decoded.id as string) || decoded.sub || '',
        name:  (decoded.name  as string) || '',
        email: (decoded.email as string) || '',
        role:  (decoded.role  as string) || 'CLIENT',
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }
  } catch {
    return null
  }
}
