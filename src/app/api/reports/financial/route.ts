export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')

  // Helper: parse SK date DD.MM.YYYY → Date or null
  function parseSkDate(s: string | null): Date | null {
    if (!s) return null
    const m = s.match(/^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{2,4})$/)
    if (!m) return null
    const [, d, mo, y] = m
    return new Date(parseInt(y.length === 2 ? '20' + y : y), parseInt(mo) - 1, parseInt(d))
  }

  const all = await prisma.invoiceOcrResult.findMany({
    where: { isDuplicate: false, error: null, totalAmount: { not: null } },
    select: {
      id: true, createdAt: true, issueDate: true, direction: true,
      supplierName: true, supplierIco: true,
      customerName: true, customerIco: true,
      invoiceNumber: true, totalAmount: true,
      dueDate: true, isPaid: true, paidAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  // Filter by issueDate (DD.MM.YYYY) or fallback to createdAt
  const fromDate = from ? new Date(from) : null
  const toDate   = to   ? new Date(to + 'T23:59:59') : null
  const filtered = (fromDate || toDate) ? all.filter(inv => {
    const d = parseSkDate(inv.issueDate) ?? new Date(inv.createdAt)
    if (fromDate && d < fromDate) return false
    if (toDate   && d > toDate)   return false
    return true
  }) : all

  const allF = filtered

  const dodavatelia = allF.filter(i => i.direction === 'dodavatel')
  const odbera      = allF.filter(i => i.direction === 'odberatel')

  // ── Monthly buckets ──────────────────────────────────────────────────────────
  const monthKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

  const monthMap: Record<string, { income: number; expense: number; paid: number; profit: number }> = {}
  for (const inv of allF) {
    const invDate = parseSkDate(inv.issueDate) ?? new Date(inv.createdAt)
    const k = monthKey(invDate)
    if (!monthMap[k]) monthMap[k] = { income: 0, expense: 0, paid: 0, profit: 0 }
    const amt = inv.totalAmount ?? 0
    if (inv.direction === 'odberatel') {
      monthMap[k].income += amt
      if (inv.isPaid) monthMap[k].paid += amt
    } else {
      monthMap[k].expense += amt
    }
  }
  for (const k of Object.keys(monthMap)) {
    monthMap[k].profit = monthMap[k].income - monthMap[k].expense
  }
  const monthly = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }))

  // ── Totals ───────────────────────────────────────────────────────────────────
  const totalIncome  = odbera.reduce((s, i) => s + (i.totalAmount ?? 0), 0)
  const totalExpense = dodavatelia.reduce((s, i) => s + (i.totalAmount ?? 0), 0)
  const totalPaid    = odbera.filter(i => i.isPaid).reduce((s, i) => s + (i.totalAmount ?? 0), 0)
  const totalUnpaid  = totalIncome - totalPaid
  const netProfit    = totalIncome - totalExpense
  const cashflow     = totalPaid - totalExpense

  // ── Top suppliers ────────────────────────────────────────────────────────────
  const supplierMap: Record<string, number> = {}
  for (const i of dodavatelia) {
    const k = i.supplierName || '(neznámy)'
    supplierMap[k] = (supplierMap[k] ?? 0) + (i.totalAmount ?? 0)
  }
  const topSuppliers = Object.entries(supplierMap)
    .sort(([, a], [, b]) => b - a).slice(0, 8)
    .map(([name, total]) => ({ name, total }))

  // ── Top customers ────────────────────────────────────────────────────────────
  const customerMap: Record<string, number> = {}
  for (const i of odbera) {
    const k = i.customerName || '(neznámy)'
    customerMap[k] = (customerMap[k] ?? 0) + (i.totalAmount ?? 0)
  }
  const topCustomers = Object.entries(customerMap)
    .sort(([, a], [, b]) => b - a).slice(0, 8)
    .map(([name, total]) => ({ name, total }))

  // ── Unpaid receivables ───────────────────────────────────────────────────────
  const today = new Date()
  const unpaid = odbera
    .filter(i => !i.isPaid)
    .map(i => {
      let overdueDays: number | null = null
      if (i.dueDate) {
        const parts = i.dueDate.match(/(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{2,4})/)
        if (parts) {
          const [, d, m, y] = parts
          const due = new Date(parseInt(y.length === 2 ? '20' + y : y), parseInt(m) - 1, parseInt(d))
          overdueDays = Math.floor((today.getTime() - due.getTime()) / 86400000)
        }
      }
      return { ...i, overdueDays }
    })
    .sort((a, b) => (b.overdueDays ?? -999) - (a.overdueDays ?? -999))

  // ── Avg payment time ─────────────────────────────────────────────────────────
  const paidWithDates = odbera.filter(i => i.isPaid && i.paidAt && i.createdAt)
  const avgPayDays = paidWithDates.length > 0
    ? Math.round(paidWithDates.reduce((s, i) => {
        return s + (new Date(i.paidAt!).getTime() - new Date(i.createdAt).getTime()) / 86400000
      }, 0) / paidWithDates.length)
    : null

  // ── Per-company breakdown ───────────────────────────────────────────────────
  const SYCOM_SYSTEMS_ICO = '53035780'
  const ownCompanies = await prisma.ownCompany.findMany({ select: { id: true, name: true, ico: true } })

  const perCompany = ownCompanies.map(company => {
    const icoMatch    = (ico: string | null) => ico === company.ico
    const nameMatch   = (name: string | null) => name != null && name.toLowerCase().includes(company.name.toLowerCase().split(' ')[0].toLowerCase())

    const vydane   = allF.filter(i => i.direction === 'odberatel' && (icoMatch(i.supplierIco) || (!i.supplierIco && nameMatch(i.supplierName))))
    const prijate  = allF.filter(i => i.direction === 'dodavatel' && (icoMatch(i.customerIco) || (!i.customerIco && nameMatch(i.customerName))))

    const sumaVydane  = vydane.reduce((s, i) => s + (i.totalAmount ?? 0), 0)
    const sumaUhrad   = vydane.filter(i => i.isPaid).reduce((s, i) => s + (i.totalAmount ?? 0), 0)
    const sumaPrijate = prijate.reduce((s, i) => s + (i.totalAmount ?? 0), 0)
    const zisk        = sumaVydane - sumaPrijate
    const dph         = company.ico === SYCOM_SYSTEMS_ICO ? zisk * 0.23 : null

    return {
      id: company.id, name: company.name, ico: company.ico,
      sumaVydane, sumaUhrad, sumaPrijate, zisk, dph,
      countVydane: vydane.length, countPrijate: prijate.length,
      countUhrad: vydane.filter(i => i.isPaid).length,
    }
  })

  return NextResponse.json({
    summary: { totalIncome, totalExpense, totalPaid, totalUnpaid, netProfit, cashflow, avgPayDays },
    monthly,
    topSuppliers,
    topCustomers,
    unpaid,
    perCompany,
    invoiceCount: { total: allF.length, income: odbera.length, expense: dodavatelia.length, paid: odbera.filter(i => i.isPaid).length },
  })
}
