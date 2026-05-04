import { logAudit } from '@/lib/audit'
// src/lib/auth.ts
import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Heslo',    type: 'password' },
      },
      async authorize(credentials, req) {
        const ip = (req as any)?.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
                ?? (req as any)?.headers?.['x-real-ip']
                ?? 'unknown'
        if (!credentials?.email || !credentials?.password) return null
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })
        if (!user) {
          logAudit(null, 'auth', credentials.email, 'login_failed_unknown', null, { email: credentials.email }, ip).catch(() => {})
          return null
        }
        if (!user.isActive) {
          logAudit(user.id, 'auth', user.id, 'login_failed_inactive', null, { email: credentials.email }, ip).catch(() => {})
          return null
        }
        const valid = await bcrypt.compare(credentials.password, user.password)
        if (!valid) {
          logAudit(user.id, 'auth', user.id, 'login_failed', null, { email: credentials.email }, ip).catch(() => {})
          return null
        }
        logAudit(user.id, 'auth', user.id, 'login_success', null, { email: credentials.email }, ip).catch(() => {})
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id   = user.id
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id   = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
  },
}
