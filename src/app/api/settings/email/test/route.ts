import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { host, port, secure, user, pass } = await req.json()
  try {
    const { ImapFlow } = await import('imapflow')
    const client = new ImapFlow({ host, port: parseInt(port)||993, secure: secure===true||secure==='true', auth: { user, pass }, logger: false })
    await client.connect()
    const status = await client.status('INBOX', { messages: true })
    await client.logout()
    return NextResponse.json({ success: true, messageCount: status.messages ?? 0 })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Connection failed' }, { status: 400 })
  }
}
