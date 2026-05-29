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
  const companies = await prisma.ownCompany.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(companies)
}

export async function POST(req: NextRequest) {
  const err = await adminOnly(req); if (err) return err
  const { name, ico } = await req.json()
  if (!name?.trim() || !ico?.trim())
    return NextResponse.json({ error: 'Názov a IČO sú povinné' }, { status: 400 })
  const clean = ico.replace(/\D/g, '')
  if (clean.length < 6 || clean.length > 12)
    return NextResponse.json({ error: 'IČO musí mať 6–12 číslic' }, { status: 400 })
  try {
    const company = await prisma.ownCompany.create({ data: { name: name.trim(), ico: clean } })
    return NextResponse.json(company)
  } catch (e: any) {
    if (e.code === 'P2002') return NextResponse.json({ error: 'Firma s týmto IČO už existuje' }, { status: 409 })
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
