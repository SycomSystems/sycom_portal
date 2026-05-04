import { NextRequest, NextResponse } from 'next/server'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
export const runtime = 'nodejs'
const SETTINGS_DIR = path.join(process.cwd(), 'public', 'uploads')
const PHONE_FILE = path.join(SETTINGS_DIR, 'phone.json')

async function getGlobalPhone(): Promise<string> {
  try {
    const data = JSON.parse(await readFile(PHONE_FILE, 'utf-8'))
    return data.phone || '0948 938 217'
  } catch {
    return '0948 938 217'
  }
}

export async function GET() {
  const globalPhone = await getGlobalPhone()
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    const userId = (session?.user as any)?.id

    if (userId && (role === 'CLIENT' || role === 'CLIENT_MANAGER')) {
      const me = await prisma.user.findUnique({ where: { id: userId }, select: { clientId: true } })
      if (me?.clientId) {
        const assignments = await prisma.clientTechnician.findMany({
          where: { clientId: me.clientId },
          include: { user: { select: { phone: true, name: true } } },
        })
        const techWithPhone = assignments.find(a => a.user.phone)
        if (techWithPhone) {
          return NextResponse.json({ phone: techWithPhone.user.phone, techName: techWithPhone.user.name })
        }
      }
    }
  } catch {}

  return NextResponse.json({ phone: globalPhone })
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
