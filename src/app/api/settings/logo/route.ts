import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Force Node.js runtime (required for fs/path usage)
export const runtime = 'nodejs'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')
const LOGO_META = path.join(process.cwd(), 'public', 'uploads', 'logo-meta.json')

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('logo') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
  }

  if (!existsSync(UPLOAD_DIR)) await mkdir(UPLOAD_DIR, { recursive: true })

  const ext = file.name.split('.').pop()
  const filename = `logo.${ext}`
  const bytes = await file.arrayBuffer()
  await writeFile(path.join(UPLOAD_DIR, filename), Buffer.from(bytes))
  await writeFile(LOGO_META, JSON.stringify({ filename, updatedAt: new Date().toISOString() }))

  return NextResponse.json({ url: `/uploads/${filename}`, filename })
}

export async function GET() {
  try {
    const meta = JSON.parse(await readFile(LOGO_META, 'utf-8'))
    return NextResponse.json(meta)
  } catch {
    return NextResponse.json({ filename: null, url: null })
  }
}
