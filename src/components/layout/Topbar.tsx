'use client'
// src/components/layout/Topbar.tsx
import { useSession, signOut } from 'next-auth/react'
import { Bell, ChevronDown, LogOut, User, Settings, Ticket, X, Menu } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

type Notif = {
  id: string; type: string; message: string
  isRead: boolean; createdAt: string; ticketId: string | null
}

export function Topbar({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const { data: session } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<Notif[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const bellRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const initials = session?.user?.name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase() ?? 'U'

  const fetchNotifications = async () => {
    try {
      const r = await fetch('/api/notifications')
      if (!r.ok) return
      const data = await r.json()
      setNotifications(data.notifications ?? [])
      setUnreadCount(data.unreadCount ?? 0)
    } catch {}
  }

  useEffect(() => {
    fetch('/api/settings/logo')
      .then(r => r.json())
      .then(data => { if (data.filename) setLogoUrl(`/uploads/${data.filename}?t=${Date.now()}`) })
      .catch(() => {})

    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  // Zatvori dropdown pri kliku mimo
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false)
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleOpenBell = () => {
    setBellOpen(v => !v)
    setMenuOpen(false)
  }

  const handleMarkAllRead = async () => {
    await fetch('/api/notifications', { method: 'PATCH' })
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    setUnreadCount(0)
  }

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'prave teraz'
    if (m < 60) return `pred ${m} min`
    const h = Math.floor(m / 60)
    if (h < 24) return `pred ${h} hod`
    return `pred ${Math.floor(h / 24)} d`
  }

  return (
    <header className="fixed top-0 left-0 right-0 h-[62px] bg-white border-b border-gray-200 flex items-center px-6 gap-4 z-40">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuToggle}
        className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors -ml-1 mr-1"
        aria-label="Menu"
      >
        <Menu size={20} />
      </button>
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Logo" className="object-contain max-h-10 max-w-[160px]" />
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
        )}
      </div>

      <div className="ml-auto flex items-center gap-3">
        {/* System status */}
        <div className="flex items-center gap-1.5 text-xs font-semibold text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Vsetky systemy funguju
        </div>

        {/* Bell */}
        <div className="relative" ref={bellRef}>
          <button
            onClick={handleOpenBell}
            className="relative w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:border-sycom-400 transition-colors"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {bellOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-bold text-gray-800">Notifikacie</p>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAllRead} className="text-[11px] text-sycom-500 hover:underline">
                      Oznacit vsetky ako precitane
                    </button>
                  )}
                  <button onClick={() => setBellOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={13} />
                  </button>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-gray-400">Ziadne notifikacie</div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      className={`px-4 py-3 hover:bg-gray-50 transition-colors ${!n.isRead ? 'bg-sycom-50' : ''}`}
                    >
                      {n.ticketId ? (
                        <Link href={`/tickets/${n.ticketId}`} onClick={() => setBellOpen(false)} className="block">
                          <div className="flex items-start gap-2">
                            <Ticket size={13} className="text-sycom-400 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs leading-snug ${!n.isRead ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                                {n.message}
                              </p>
                              <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(n.createdAt)}</p>
                            </div>
                            {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-sycom-500 mt-1 shrink-0" />}
                          </div>
                        </Link>
                      ) : (
                        <div className="flex items-start gap-2">
                          <Bell size={13} className="text-gray-400 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-700 leading-snug">{n.message}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(n.createdAt)}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => { setMenuOpen(v => !v); setBellOpen(false) }}
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
                <User size={13} /> Moj profil
              </Link>
              <Link href="/settings" className="flex items-center gap-2 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 hover:text-sycom-500 transition-colors">
                <Settings size={13} /> Nastavenia
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut size={13} /> Odhlasit sa
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
