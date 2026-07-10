import { NextRequest, NextResponse } from 'next/server'
import { getMobileSession } from '@/lib/mobile-session'
import { prisma } from '@/lib/prisma'

// GET — zoznam zámkov (ADMIN + AGENT, aby výkaz vedel zobraziť stav a zablokovať úpravy)
export async function GET(req: NextRequest) {
  const session = await getMobileSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'ADMIN' && role !== 'AGENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year')
  const where: any = {}
  if (year) where.year = parseInt(year)

  const locks = await prisma.vykazLock.findMany({
    where,
    include: { lockedBy: { select: { id: true, name: true } } },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  })
  return NextResponse.json(locks)
}

// POST — zamknúť klient-mesiac (ADMIN). Body: { clientId, year, month } alebo { all:true, year, month }
export async function POST(req: NextRequest) {
  const session = await getMobileSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const uid = (session.user as any).id

  const { clientId, clientIds, year, month, all } = await req.json()
  const y = parseInt(year), m = parseInt(month)
  if (!y || !m || m < 1 || m > 12) return NextResponse.json({ error: 'Neplatny rok/mesiac' }, { status: 400 })

  // zamknúť všetkých, alebo vybraných (clientIds), inak jedného (clientId)
  let ids: string[] | null = null
  if (all) {
    ids = (await prisma.client.findMany({ select: { id: true } })).map(c => c.id)
  } else if (Array.isArray(clientIds) && clientIds.length) {
    ids = clientIds.filter((x: any) => typeof x === 'string' && x)
  }
  if (ids) {
    await prisma.$transaction(ids.map(cid =>
      prisma.vykazLock.upsert({
        where: { clientId_year_month: { clientId: cid, year: y, month: m } },
        create: { clientId: cid, year: y, month: m, lockedById: uid },
        update: {},
      })
    ))
    return NextResponse.json({ ok: true, locked: ids.length })
  }

  if (!clientId) return NextResponse.json({ error: 'Chyba clientId' }, { status: 400 })
  const lock = await prisma.vykazLock.upsert({
    where: { clientId_year_month: { clientId, year: y, month: m } },
    create: { clientId, year: y, month: m, lockedById: uid },
    update: {},
    include: { lockedBy: { select: { id: true, name: true } } },
  })
  return NextResponse.json(lock, { status: 201 })
}

// DELETE — odomknúť (ADMIN). ?clientId&year&month  alebo  ?all=1&year&month
export async function DELETE(req: NextRequest) {
  const session = await getMobileSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const y = parseInt(searchParams.get('year') || '')
  const m = parseInt(searchParams.get('month') || '')
  const all = searchParams.get('all') === '1'
  const clientId = searchParams.get('clientId')
  const clientIdsParam = searchParams.get('clientIds')
  if (!y || !m) return NextResponse.json({ error: 'Neplatny rok/mesiac' }, { status: 400 })

  if (all) {
    const res = await prisma.vykazLock.deleteMany({ where: { year: y, month: m } })
    return NextResponse.json({ ok: true, unlocked: res.count })
  }
  if (clientIdsParam) {
    const ids = clientIdsParam.split(',').filter(Boolean)
    const res = await prisma.vykazLock.deleteMany({ where: { year: y, month: m, clientId: { in: ids } } })
    return NextResponse.json({ ok: true, unlocked: res.count })
  }
  if (!clientId) return NextResponse.json({ error: 'Chyba clientId' }, { status: 400 })
  await prisma.vykazLock.deleteMany({ where: { clientId, year: y, month: m } })
  return NextResponse.json({ ok: true })
}
