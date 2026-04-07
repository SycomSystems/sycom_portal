'use client'
// src/components/layout/Sidebar.tsx
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Ticket, Plus, BookOpen, Users, BarChart2, Settings, Phone, Building2 } from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  roles?: string[]
}

const navItems: NavItem[] = [
  { href: '/dashboard',     label: 'Dashboard',      icon: <LayoutDashboard size={16} /> },
  { href: '/tickets',       label: 'Tikety',         icon: <Ticket size={16} /> },
  { href: '/tickets/new',   label: 'Nový tiket',     icon: <Plus size={16} /> },
  // KB only for staff
  { href: '/kb',            label: 'Znalostná báza', icon: <BookOpen size={16} />, roles: ['ADMIN', 'AGENT'] },
  { href: '/admin/users',   label: 'Používatelia',   icon: <Users size={16} />,     roles: ['ADMIN'] },
  { href: '/admin/clients', label: 'Klienti',        icon: <Building2 size={16} />, roles: ['ADMIN'] },
  { href: '/admin/teams',   label: 'Tímy',           icon: <Users size={16} />,     roles: ['ADMIN', 'AGENT'] },
  { href: '/admin/reports', label: 'Reporty',        icon: <BarChart2 size={16} />, roles: ['ADMIN', 'AGENT'] },
  { href: '/settings',      label: 'Nastavenia',     icon: <Settings size={16} />,  roles: ['ADMIN'] },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role ?? 'CLIENT'

  const [helpdeskPhone, setHelpdeskPhone] = useState('0948 938 217')
  const [ticketBadge,   setTicketBadge]   = useState(0)

  useEffect(() => {
    fetch('/api/settings/phone')
      .then(r => r.json())
      .then(d => setHelpdeskPhone(d.phone || '0948 938 217'))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (role !== 'ADMIN' && role !== 'AGENT') return
    const fetchBadge = () => {
      fetch('/api/tickets/badge')
        .then(r => r.json())
        .then(d => setTicketBadge(d.count ?? 0))
        .catch(() => {})
    }
    fetchBadge()
    const interval = setInterval(fetchBadge, 30000)
    return () => clearInterval(interval)
  }, [role])

  const visibleItems = navItems.filter(item =>
    !item.roles || item.roles.includes(role)
  )

  return (
    <aside className="w-60 shrink-0 h-screen sticky top-0 flex flex-col bg-white border-r border-gray-100">
      <div className="h-16 flex items-center px-5 border-b border-gray-100">
        <span className="text-lg font-bold text-sycom-600">Sycom</span>
        <span className="text-lg font-bold text-gray-400">Portal</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {visibleItems.map(item => {
          const isActive   = pathname === item.href || pathname.startsWith(item.href + '/')
          const isTickets  = item.href === '/tickets'
          const showBadge  = isTickets && ticketBadge > 0

          return (
            <Link key={item.href} href={item.href}
              className={cn(
                'flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                isActive
                  ? 'bg-sycom-50 text-sycom-600'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
              )}>
              <span className="flex items-center gap-3">
                <span className={cn('shrink-0', isActive ? 'text-sycom-500' : 'text-gray-400')}>
                  {item.icon}
                </span>
                {item.label}
              </span>
              {showBadge && (
                <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[11px] font-bold rounded-full">
                  {ticketBadge > 99 ? '99+' : ticketBadge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-2 px-3 py-2.5 bg-sycom-50 rounded-xl">
          <Phone size={14} className="text-sycom-500 shrink-0" />
          <div>
            <p className="text-[10px] font-bold text-sycom-600 uppercase tracking-wider">Helpdesk</p>
            <p className="text-xs font-semibold text-gray-700">{helpdeskPhone}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
