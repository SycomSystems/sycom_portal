import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'

const LOG_DIR = '/opt/sycom-portal/logs'

interface SmtpEntry { ts: string; type: string; to?: string; subject?: string; ok: boolean; err?: string }

function readFile(filePath: string): SmtpEntry[] {
  try {
    const raw = filePath.endsWith('.gz')
      ? zlib.gunzipSync(fs.readFileSync(filePath))
      : fs.readFileSync(filePath)
    return raw.toString().trim().split('\n').filter(Boolean).flatMap(line => {
      try { return [JSON.parse(line) as SmtpEntry] } catch { return [] }
    })
  } catch { return [] }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const days   = Math.min(365, Math.max(1, parseInt(searchParams.get('days') || '7')))
  const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000)

  let entries: SmtpEntry[] = []
  if (fs.existsSync(LOG_DIR)) {
    for (const file of fs.readdirSync(LOG_DIR)) {
      if (!file.startsWith('smtp-')) continue
      const match = file.match(/smtp-(\d{4}-\d{2})/)
      if (!match) continue
      const monthStart = new Date(match[1] + '-01')
      const monthEnd   = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
      if (monthEnd < cutoff) continue
      entries.push(...readFile(path.join(LOG_DIR, file)).filter(e => new Date(e.ts) >= cutoff))
    }
  }

  entries.sort((a, b) => b.ts.localeCompare(a.ts))
  return NextResponse.json({ entries: entries.slice(0, 500), total: entries.length })
}
