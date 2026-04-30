'use client'
import { useState } from 'react'
import { Topbar } from './Topbar'
import { Sidebar } from './Sidebar'

export function PortalLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  return (
    <>
      <Topbar onMenuToggle={() => setSidebarOpen(v => !v)} />
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="pt-[62px] md:ml-60 min-h-screen overflow-x-hidden">
        {children}
      </main>
    </>
  )
}
