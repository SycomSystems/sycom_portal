import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function isStaff(role: string) {
  return role === 'ADMIN' || role === 'AGENT'
}

function slugify(text: string) {
  return text.toLowerCase()
    .replace(/[áäà]/g, 'a').replace(/[éě]/g, 'e').replace(/[íî]/g, 'i')
    .replace(/[óô]/g, 'o').replace(/[úů]/g, 'u').replace(/[č]/g, 'c')
    .replace(/[š]/g, 's').replace(/[ž]/g, 'z').replace(/[ý]/g, 'y')
    .replace(/[ňň]/g, 'n').replace(/[ľĺ]/g, 'l').replace(/[ŕ]/g, 'r')
    .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (!isStaff(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const article = await prisma.kbArticle.findUnique({ where: { id: params.id } })
  if (!article) return NextResponse.json({ error: 'Nenájdené' }, { status: 404 })
  return NextResponse.json(article)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (!isStaff(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { title, body: articleBody, category, tags, isPublished } = body
  if (!title || !articleBody) return NextResponse.json({ error: 'Chýba nadpis alebo obsah' }, { status: 400 })

  const current = await prisma.kbArticle.findUnique({ where: { id: params.id } })
  if (!current) return NextResponse.json({ error: 'Nenájdené' }, { status: 404 })

  let slug = current.slug
  if (title !== current.title) {
    slug = slugify(title)
    const existing = await prisma.kbArticle.findFirst({ where: { slug, NOT: { id: params.id } } })
    if (existing) slug = `${slug}-${Date.now()}`
  }

  const updated = await prisma.kbArticle.update({
    where: { id: params.id },
    data: { title, body: articleBody, category: category || 'Iné', tags, isPublished: !!isPublished, slug }
  })
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })

  await prisma.kbArticle.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
