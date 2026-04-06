'use client'
// src/components/layout/Sidebar.tsx
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Ticket, Plus, BookOpen, Users,
  BarChart2, Settings, Wifi, Phone,
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  badge?: number
  roles?: string[]
}

const navItems: NavItem[] = [
  { href: '/dashboard',        label: 'Dashboard',      icon: <LayoutDashboard size={16} /> },
  { href: '/tickets',          label: 'Tikety',         icon: <Ticket size={16} />,   badge: 12 },
  { href: '/tickets/new',      label: 'Nový tiket',     icon: <Plus size={16} /> },
  { href: '/kb',               label: 'Znalostná báza', icon: <BookOpen size={16} /> },
  { href: '/admin/users',      label: 'Používatelia',   icon: <Users size={16} />,    roles: ['ADMIN'] },
  { href: '/admin/teams',      label: 'Tímy',           icon: <Users size={16} />,    roles: ['ADMIN', 'AGENT'] },
  { href: '/admin/reports',    label: 'Reporty',        icon: <BarChart2 size={16} />,roles: ['ADMIN', 'AGENT'] },
  { href: '/settings',         label: 'Nastavenia',     icon: <Settings size={16} />, roles: ['ADMIN'] },
]

export function Sidebar() {
  const pathname  = usePathname()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role ?? 'CLIENT'

  const visible = navItems.filter(item =>
    !item.roles || item.roles.includes(role)
  )

  return (
    <aside className="w-[220px] flex-shrink-0 bg-white border-r border-gray-200 fixed top-[62px] bottom-0 left-0 flex flex-col py-5 px-3 overflow-y-auto">

      <nav className="flex flex-col gap-0.5 flex-1">
        <p className="text-[9px] font-bold tracking-[1.8px] uppercase text-gray-400 px-3 pb-1 pt-2">
          Hlavné menu
        </p>
        {visible.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'nav-item',
              pathname.startsWith(item.href) && item.href !== '/dashboard'
                ? 'active'
                : pathname === item.href
                  ? 'active'
                  : ''
            )}
          >
            {item.icon}
            <span className="flex-1">{item.label}</span>
            {item.badge && (
              <span className={cn(
                'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                pathname.startsWith(item.href) ? 'bg-white/25 text-white' : 'bg-red-500 text-white'
              )}>
                {item.badge}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {/* Helpdesk card */}
      <div className="mt-4 p-3 bg-sycom-50 border border-sycom-200 rounded-xl text-center">
        <Phone size={20} className="mx-auto mb-1 text-sycom-500" />
        <p className="text-[11px] font-bold text-sycom-600 mb-0.5">Helpdesk linka</p>
        <p className="font-mono text-xs text-gray-700">0948 938 217</p>
      </div>
    </aside>
  )
}
