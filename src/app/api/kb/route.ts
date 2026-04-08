import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createSchema = z.object({
  title:       z.string().min(5),
  body:        z.string().min(10),
  category:    z.string().optional(),
  tags:        z.string().optional(),
  isPublished: z.boolean().optional(),
})

function slugify(text: string) {
  return text.toLowerCase()
    .replace(/[áäà]/g, 'a').replace(/[éě]/g, 'e').replace(/[íî]/g, 'i')
    .replace(/[óô]/g, 'o').replace(/[úů]/g, 'u').replace(/[č]/g, 'c')
    .replace(/[š]/g, 's').replace(/[ž]/g, 'z').replace(/[ý]/g, 'y')
    .replace(/[^\\w\\s-]/g, '').replace(/\\s+/g, '-').replace(/-+/g, '-').trim()
}

function isStaff(role: string) {
  return role === 'ADMIN' || role === 'AGENT'
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (!isStaff(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const all = searchParams.get('all') === '1'
  const category = searchParams.get('category')
  const search = searchParams.get('q')

  const where: any = {}
  if (!all) where.isPublished = true
  if (category) where.category = category
  if (search) where.OR = [
    { title: { contains: search } },
    { body: { contains: search } },
    { tags: { contains: search } },
  ]

  const articles = await prisma.kbArticle.findMany({
    where,
    orderBy: [{ isPublished: 'desc' }, { updatedAt: 'desc' }],
    select: { id: true, slug: true, title: true, category: true, tags: true, isPublished: true, createdAt: true, updatedAt: true },
  })
  return NextResponse.json(articles)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (!isStaff(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Neplatné dáta' }, { status: 400 })

  const { title, body: articleBody, category = 'Iné', tags, isPublished = false } = parsed.data
  let slug = slugify(title)
  const existing = await prisma.kbArticle.findUnique({ where: { slug } })
  if (existing) slug = `${slug}-${Date.now()}`

  const article = await prisma.kbArticle.create({
    data: { title, body: articleBody, category, tags, isPublished, slug }
  })
  return NextResponse.json(article, { status: 201 })
}
