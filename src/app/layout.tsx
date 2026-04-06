// src/app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/components/layout/Providers'

export const metadata: Metadata = {
  title: 'Sycom IT Podpora',
  description: 'IT Support Portal — Sycom s.r.o.',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
