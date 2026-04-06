import { NextRequest, NextResponse } from 'next/server'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const runtime = 'nodejs'

const SETTINGS_DIR = path.join(process.cwd(), 'public', 'uploads')
const PHONE_FILE = path.join(SETTINGS_DIR, 'phone.json')

export async function GET() {
  try {
    const data = JSON.parse(await readFile(PHONE_FILE, 'utf-8'))
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ phone: '0948 938 217' })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { phone } = await req.json()
  if (!phone || typeof phone !== 'string') {
    return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
  }

  if (!existsSync(SETTINGS_DIR)) await mkdir(SETTINGS_DIR, { recursive: true })
  await writeFile(PHONE_FILE, JSON.stringify({ phone: phone.trim(), updatedAt: new Date().toISOString() }))

  return NextResponse.json({ phone: phone.trim() })
}
