import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function adminOnly(req: NextRequest) {
  const s = await getServerSession(authOptions)
  if (!s || s.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

export async function GET(req: NextRequest) {
  const err = await adminOnly(req); if (err) return err
  const hints = await prisma.supplierHint.findMany({ orderBy: { supplierName: 'asc' } })
  return NextResponse.json(hints)
}

export async function POST(req: NextRequest) {
  const err = await adminOnly(req); if (err) return err
  const { supplierName, hint } = await req.json()
  if (!supplierName?.trim() || !hint?.trim())
    return NextResponse.json({ error: 'Vyplňte dodávateľa aj poznámku' }, { status: 400 })
  const h = await prisma.supplierHint.upsert({
    where:  { supplierName: supplierName.trim() },
    update: { hint: hint.trim() },
    create: { supplierName: supplierName.trim(), hint: hint.trim() },
  })
  return NextResponse.json(h)
}
