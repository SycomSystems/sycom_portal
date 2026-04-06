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
    .replace(/[ňň]/g, 'n').replace(/[ľĺ]/g, 'l').replace(/[ŕ]/g, 'r')
    .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const search    = searchParams.get('search')
  const category  = searchParams.get('category')
  const published = searchParams.get('published')

  const where: any = {}
  if (published !== 'all') where.isPublished = true
  if (category) where.category = category
  if (search) where.OR = [
    { title: { contains: search } },
    { body:  { contains: search } },
  ]

  const articles = await prisma.kbArticle.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  // Derive unique categories from articles
  const categorySet = new Set<string>()
  articles.forEach(a => { if (a.category) categorySet.add(a.category) })
  const categories = Array.from(categorySet)

  return NextResponse.json({ articles, categories })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role === 'CLIENT' || role === 'CLIENT_MANAGER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body   = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const slug = slugify(parsed.data.title) + '-' + Date.now()

  const article = await prisma.kbArticle.create({
    data: {
      title:       parsed.data.title,
      body:        parsed.data.body,
      category:    parsed.data.category || 'Všeobecné',
      tags:        parsed.data.tags || null,
      isPublished: parsed.data.isPublished ?? false,
      slug,
    },
  })

  return NextResponse.json(article, { status: 201 })
}
