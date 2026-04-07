#!/usr/bin/env python3
import os

base = '/opt/sycom-portal'

files = {}

files['src/app/api/vykaz/route.ts'] = """import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const HOURS_LABELS: Record<string, string> = {
  STANDARD: 'Standard',
  STANDARD_MIMO: 'Standard mimo prac. casu',
  SERVER: 'Server',
  SERVER_MIMO: 'Server mimo prac. casu',
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'ADMIN' && role !== 'AGENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const clientId = searchParams.get('clientId')

  const dateFrom = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const dateTo = to ? new Date(to) : new Date()
  dateTo.setHours(23, 59, 59, 999)

  const commentWhere: any = { workedHours: { gt: 0 }, createdAt: { gte: dateFrom, lte: dateTo } }
  if (clientId) commentWhere.ticket = { clientId }

  const comments = await prisma.comment.findMany({
    where: commentWhere,
    include: {
      ticket: { select: { id: true, ticketNumber: true, subject: true, clientId: true, client: { select: { id: true, name: true } } } },
      author: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const movementWhere: any = { type: 'SELL', date: { gte: dateFrom, lte: dateTo } }
  if (clientId) movementWhere.clientId = clientId

  const movements = await prisma.stockMovement.findMany({
    where: movementWhere,
    include: { stockItem: true, addedBy: { select: { id: true, name: true } }, client: { select: { id: true, name: true } } },
    orderBy: { date: 'asc' },
  })

  let clientPricing: any[] = clientId
    ? await prisma.clientPricing.findMany({ where: { clientId } })
    : await prisma.clientPricing.findMany()

  const pricingMap: Record<string, Record<string, number>> = {}
  for (const p of clientPricing) {
    if (!pricingMap[p.clientId]) pricingMap[p.clientId] = {}
    pricingMap[p.clientId][p.hoursType] = p.pricePerHour
  }

  const hourRows = comments.map(c => {
    const hoursType = c.hoursType ?? 'STANDARD'
    const clientPrices = c.ticket.client?.id ? pricingMap[c.ticket.client.id] ?? {} : {}
    const pricePerHour = clientPrices[hoursType] ?? 0
    return {
      rowType: 'hours',
      date: c.createdAt,
      ticketId: c.ticket.id,
      ticketNumber: c.ticket.ticketNumber,
      ticketSubject: c.ticket.subject,
      hoursType,
      hoursTypeLabel: HOURS_LABELS[hoursType] ?? hoursType,
      hours: c.workedHours,
      pricePerHour,
      totalPrice: Math.round(c.workedHours * pricePerHour * 100) / 100,
      addedBy: c.author.name,
      client: c.ticket.client,
    }
  })

  const goodsRows = movements.map(m => ({
    rowType: 'goods',
    date: m.date,
    itemName: m.stockItem.name,
    quantity: m.quantity,
    pricePerUnit: m.pricePerUnit,
    totalPrice: m.totalPrice,
    vatRate: m.vatRate,
    addedBy: m.addedBy.name,
    client: m.client,
  }))

  const hoursByType: Record<string, number> = {}
  let totalHoursPrice = 0
  for (const r of hourRows) {
    hoursByType[r.hoursTypeLabel] = (hoursByType[r.hoursTypeLabel] ?? 0) + r.hours
    totalHoursPrice += r.totalPrice
  }
  const totalGoodsPrice = goodsRows.reduce((s, r) => s + r.totalPrice, 0)

  return NextResponse.json({
    hourRows,
    goodsRows,
    summary: {
      hoursByType,
      totalHoursPrice: Math.round(totalHoursPrice * 100) / 100,
      totalGoodsPrice: Math.round(totalGoodsPrice * 100) / 100,
      totalPrice: Math.round((totalHoursPrice + totalGoodsPrice) * 100) / 100,
    },
  })
}
"""

files['src/app/(admin)/admin/reports/vykaz/page.tsx'] = r"""'use client'
import { useState, useMemo } from 'react'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { useQuery } from '@tanstack/react-query'
import { Clock, Package, Euro, FileText, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'

function fmt(n: number) { return n.toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('sk-SK') }

const HOURS_COLORS: Record<string, string> = {
  Standard: 'bg-blue-100 text-blue-700',
  'Standard mimo prac. casu': 'bg-indigo-100 text-indigo-700',
  Server: 'bg-purple-100 text-purple-700',
  'Server mimo prac. casu': 'bg-orange-100 text-orange-700',
}

export default function VykazPage() {
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const today = now.toISOString().slice(0, 10)

  const [from, setFrom] = useState(firstDay)
  const [to, setTo] = useState(today)
  const [clientId, setClientId] = useState('')
  const [sortCol, setSortCol] = useState('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => fetch('/api/clients').then(r => r.json()),
  })

  const params = new URLSearchParams({ from, to })
  if (clientId) params.set('clientId', clientId)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vykaz', from, to, clientId],
    queryFn: () => fetch('/api/vykaz?' + params).then(r => r.json()),
    enabled: false,
  })

  function SortIcon({ col }: { col: string }) {
    if (sortCol !== col) return <ChevronUp size={12} className="text-gray-300" />
    return sortDir === 'asc' ? <ChevronUp size={12} className="text-sycom-500" /> : <ChevronDown size={12} className="text-sycom-500" />
  }

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const allRows = useMemo(() => {
    if (!data) return []
    const hours = (data.hourRows ?? []).map((r: any) => ({ ...r, _type: 'hours' }))
    const goods = (data.goodsRows ?? []).map((r: any) => ({ ...r, _type: 'goods' }))
    const combined = [...hours, ...goods]
    combined.sort((a, b) => {
      let av: any, bv: any
      if (sortCol === 'date') { av = new Date(a.date).getTime(); bv = new Date(b.date).getTime() }
      else if (sortCol === 'name') { av = a.ticketSubject ?? a.itemName ?? ''; bv = b.ticketSubject ?? b.itemName ?? '' }
      else if (sortCol === 'type') { av = a.hoursTypeLabel ?? 'Tovar'; bv = b.hoursTypeLabel ?? 'Tovar' }
      else if (sortCol === 'qty') { av = a.hours ?? a.quantity ?? 0; bv = b.hours ?? b.quantity ?? 0 }
      else if (sortCol === 'price') { av = a.pricePerHour ?? a.pricePerUnit ?? 0; bv = b.pricePerHour ?? b.pricePerUnit ?? 0 }
      else if (sortCol === 'total') { av = a.totalPrice ?? 0; bv = b.totalPrice ?? 0 }
      else if (sortCol === 'who') { av = a.addedBy ?? ''; bv = b.addedBy ?? '' }
      else return 0
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return combined
  }, [data, sortCol, sortDir])

  const summary = data?.summary

  return (
    <PortalLayout>
      <div className="max-w-6xl mx-auto py-8 px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText size={22} className="text-sycom-500" /> Vykaz
          </h1>
          <p className="text-sm text-gray-500 mt-1">Prehled odpracovanych hodin a predaneho tovaru pre klienta.</p>
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Datum od</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Datum do</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Klient</label>
              <select value={clientId} onChange={e => setClientId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 bg-white">
                <option value="">Vsetci klienti</option>
                {(clients ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <button onClick={() => refetch()}
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-sycom-500 text-white text-sm font-semibold rounded-xl hover:bg-sycom-600 transition-colors">
                <FileText size={15} /> Generovat vykaz
              </button>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="text-center py-12 text-gray-400 text-sm">Nacitavam...</div>
        )}

        {summary && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {/* Hours by type */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:col-span-1">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-sycom-50 flex items-center justify-center"><Clock size={15} className="text-sycom-500" /></div>
                  <p className="text-sm font-semibold text-gray-700">Hodiny podla typu</p>
                </div>
                <div className="space-y-2">
                  {Object.entries(summary.hoursByType).map(([type, hours]: [string, any]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className={'text-[11px] font-bold px-2 py-0.5 rounded-full ' + (HOURS_COLORS[type] ?? 'bg-gray-100 text-gray-600')}>{type}</span>
                      <span className="text-sm font-bold text-gray-800">{hours} hod</span>
                    </div>
                  ))}
                  {Object.keys(summary.hoursByType).length === 0 && <p className="text-xs text-gray-400">Ziadne hodiny</p>}
                </div>
              </div>

              {/* Price for work */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center"><Euro size={15} className="text-green-600" /></div>
                  <p className="text-sm font-semibold text-gray-700">Cena za prace</p>
                </div>
                <p className="text-3xl font-bold text-gray-900">{fmt(summary.totalHoursPrice)} <span className="text-base font-medium text-gray-400">EUR</span></p>
                <p className="text-xs text-gray-400 mt-1">bez DPH</p>
              </div>

              {/* Price for goods + total */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center"><Package size={15} className="text-blue-600" /></div>
                  <p className="text-sm font-semibold text-gray-700">Cena za tovar</p>
                </div>
                <p className="text-3xl font-bold text-gray-900">{fmt(summary.totalGoodsPrice)} <span className="text-base font-medium text-gray-400">EUR</span></p>
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Spolu bez DPH</p>
                    <p className="text-lg font-bold text-sycom-600">{fmt(summary.totalPrice)} EUR</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Detail table */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">Detail</h2>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{allRows.length} zaznamov</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {[['date','Datum'],['name','Nazov'],['type','Typ hodin / Tovar'],['qty','Pocet / Mnozstvo'],['price','Cena/hod alebo Cena/ks'],['total','Spolu bez DPH'],['who','Zapisal'],['link','Tiket']].map(([col,label]) => (
                        <th key={col} onClick={() => toggleSort(col)}
                          className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none whitespace-nowrap">
                          <span className="flex items-center gap-1">{label} <SortIcon col={col} /></span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {allRows.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">Ziadne zaznamy pre zvolene filtre.</td></tr>
                    ) : allRows.map((row: any, i: number) => (
                      <tr key={i} className={'hover:bg-gray-50 transition-colors ' + (row._type === 'goods' ? 'bg-blue-50/30' : '')}>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-500">{fmtDate(row.date)}</td>
                        <td className="px-4 py-3 text-gray-900 font-medium max-w-xs">
                          {row._type === 'hours' ? (
                            <span>{row.ticketSubject}</span>
                          ) : (
                            <span className="flex items-center gap-1"><Package size={12} className="text-blue-400 shrink-0" />{row.itemName}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {row._type === 'hours' ? (
                            <span className={'text-[11px] font-bold px-2 py-0.5 rounded-full ' + (HOURS_COLORS[row.hoursTypeLabel] ?? 'bg-gray-100 text-gray-600')}>
                              {row.hoursTypeLabel}
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Tovar</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium">
                          {row._type === 'hours' ? row.hours + ' hod' : row.quantity + ' ks'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {row._type === 'hours'
                            ? (row.pricePerHour > 0 ? fmt(row.pricePerHour) + ' EUR' : <span className="text-gray-300">—</span>)
                            : fmt(row.pricePerUnit) + ' EUR'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-semibold text-gray-800">
                          {row.totalPrice > 0 ? fmt(row.totalPrice) + ' EUR' : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-500">{row.addedBy}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {row._type === 'hours' && row.ticketId ? (
                            <a href={'/tickets/' + row.ticketId} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 text-sycom-500 hover:text-sycom-700 text-xs font-medium">
                              #T-{row.ticketNumber} <ExternalLink size={11} />
                            </a>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {allRows.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-end gap-6 text-xs">
                  <span className="text-gray-400">Prace: <strong className="text-gray-700">{fmt(summary.totalHoursPrice)} EUR</strong></span>
                  <span className="text-gray-400">Tovar: <strong className="text-gray-700">{fmt(summary.totalGoodsPrice)} EUR</strong></span>
                  <span className="font-bold text-sycom-600">Celkom: {fmt(summary.totalPrice)} EUR bez DPH</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </PortalLayout>
  )
}
"""

for path, content in files.items():
    full_path = os.path.join(base, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Created: {path}')

print('Done!')
