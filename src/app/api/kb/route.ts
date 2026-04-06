// src/app/api/kb/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createSchema = z.object({
  title:      z.string().min(5),
  content:    z.string().min(10),
  excerpt:    z.string().optional(),
  categoryId: z.string().optional(),
  isPublished:z.boolean().optional(),
})

function slugify(text: string) {
  return text.toLowerCase()
    .replace(/[áäà]/g, 'a').replace(/[éě]/g, 'e').replace(/[íî]/g, 'i')
    .replace(/[óô]/g, 'o').replace(/[úů]/g, 'u').replace(/[č]/g, 'c')
    .replace(/[š]/g, 's').replace(/[ž]/g, 'z').replace(/[ý]/g, 'y')
    .replace(/[ňň]/g, 'n').replace(/[ľĺ]/g, 'l').replace(/[ŕ]/g, 'r')
    .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const search     = searchParams.get('search')
  const categoryId = searchParams.get('categoryId')
  const published  = searchParams.get('published')

  const where: any = {}
  if (published !== 'all') where.isPublished = true
  if (categoryId) where.categoryId = categoryId
  if (search) where.OR = [
    { title:   { contains: search } },
    { excerpt: { contains: search } },
    { content: { contains: search } },
  ]

  const [articles, categories] = await Promise.all([
    prisma.kbArticle.findMany({
      where,
      include: { category: true },
      orderBy: { viewCount: 'desc' },
    }),
    prisma.kbCategory.findMany({ orderBy: { sortOrder: 'asc' } }),
  ])

  return NextResponse.json({ articles, categories })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role === 'CLIENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body   = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const slug    = slugify(parsed.data.title)
  const article = await prisma.kbArticle.create({
    data: {
      ...parsed.data,
      slug,
      authorId: (session.user as any).id,
    },
  })

  return NextResponse.json(article, { status: 201 })
}
