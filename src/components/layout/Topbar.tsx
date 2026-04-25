'use client'
// src/components/layout/Topbar.tsx
import { useSession, signOut } from 'next-auth/react'
import { Bell, ChevronDown, LogOut, User, Settings } from 'lucide-react'
import { useState, useEffect } from 'react'
import Link from 'next/link'

export function Topbar() {
  const { data: session } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  const initials = session?.user?.name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase() ?? 'U'

  useEffect(() => {
    fetch('/api/settings/logo')
      .then(r => r.json())
      .then(data => {
        if (data.filename) setLogoUrl(`/uploads/${data.filename}?t=${Date.now()}`)
      })
      .catch(() => {})
  }, [])

  return (
    <header className="fixed top-0 left-0 right-0 h-[62px] bg-white border-b border-gray-200 flex items-center px-6 gap-4 z-40">
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt="Logo"
            className="object-contain max-h-10 max-w-[160px]"
          />
        ) : (
          <>
            <div className="w-9 h-9 bg-sycom-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="3" width="20" height="14" rx="2" stroke="white" strokeWidth="1.8" />
                <path d="M8 21h8M12 17v4" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M7 10l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div className="text-xl font-bold text-sycom-500 leading-none tracking-tight">sycom</div>
              <div className="text-[9px] font-bold tracking-widest uppercase text-gray-400 leading-none mt-0.5">IT Podpora</div>
            </div>
          </>
        )}</div>

      <div className="ml-auto flex items-center gap-3">
        {/* System status */}
        <div className="flex items-center gap-1.5 text-xs font-semibold text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Všetky systémy fungujú
        </div>

        {/* Notifications */}
        <button className="relative w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:border-sycom-400 transition-colors">
          <Bell size={16} />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">3</span>
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-full border border-gray-200 hover:border-sycom-400 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-sycom-500 text-white text-xs font-bold flex items-center justify-center">
              {initials}
            </div>
            <span className="text-xs font-semibold text-gray-800 pr-1">{session?.user?.name}</span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-44 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50">
              <div className="px-3 py-2 border-b border-gray-100">
                <p className="text-xs font-bold text-gray-800">{session?.user?.name}</p>
                <p className="text-[11px] text-gray-400">{session?.user?.email}</p>
              </div>
              <Link href="/settings/profile" className="flex items-center gap-2 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 hover:text-sycom-500 transition-colors">
                <User size={13} /> Môj profil
              </Link>
              <Link href="/settings" className="flex items-center gap-2 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 hover:text-sycom-500 transition-colors">
                <Settings size={13} /> Nastavenia
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut size={13} /> Odhlásiť sa
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
