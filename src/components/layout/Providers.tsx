'use client'
// src/components/layout/Providers.tsx
import { SessionProvider } from 'next-auth/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 60 * 1000 } },
  }))

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              fontFamily: 'DM Sans, sans-serif',
              fontSize: '13px',
              fontWeight: '600',
              borderRadius: '10px',
            },
            success: { style: { background: '#2a9d5c', color: 'white' } },
            error:   { style: { background: '#e63946', color: 'white' } },
          }}
        />
      </QueryClientProvider>
    </SessionProvider>
  )
}
