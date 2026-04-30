'use client'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { PortalLayout } from '@/components/layout/PortalLayout'
import Link from 'next/link'
import { Plus } from 'lucide-react'

const STATUS_LABEL: Record<string, string> = {
  DOPYT:            'Dopyt',
  PONUKA_ODOSLANA:  'Ponuka odoslaná',
  SCHVALENA:        'Schválená',
  ZAMIETNUTA:       'Zamietnutá',
}
const STATUS_COLOR: Record<string, string> = {
  DOPYT:            'bg-gray-100 text-gray-600',
  PONUKA_ODOSLANA:  'bg-blue-100 text-blue-700',
  SCHVALENA:        'bg-green-100 text-green-700',
  ZAMIETNUTA:       'bg-red-100 text-red-600',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('sk-SK')
}

export default function OrdersPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const router = useRouter()

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => fetch('/api/orders').then(r => r.json()),
  })

  return (
    <PortalLayout>
      <div className="w-full py-4 px-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-gray-800">Objednávky</h1>
            <p className="text-xs text-gray-400">Cenové dopyty a ponuky</p>
          </div>
          <Link href="/orders/new" className="flex items-center gap-1.5 bg-blue-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-blue-700 transition">
            <Plus size={15} /> Nový dopyt
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Načítavam...</div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">Zatiaľ žiadne objednávky</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">#</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Stav</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Klient</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Položky</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Vytvorené</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Vytvoril</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((o: any) => (
                  <tr key={o.id} onClick={() => router.push(`/orders/${o.id}`)} className="hover:bg-gray-50 cursor-pointer transition">
                    <td className="px-5 py-3.5 text-sm font-mono text-gray-500">#{o.orderNumber}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[o.status]}`}>
                        {STATUS_LABEL[o.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{o.client?.name ?? '—'}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-500">{o.items?.length ?? 0} pol.</td>
                    <td className="px-5 py-3.5 text-sm text-gray-500">{formatDate(o.createdAt)}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-500">{o.creator?.name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </PortalLayout>
  )
}
