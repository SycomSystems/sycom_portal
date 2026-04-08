#!/usr/bin/env python3
import os

base = '/opt/sycom-portal'
files = {}

# ─────────────────────────────────────────────────────────────
# 1. API /api/kb/[id]/route.ts  — GET / PUT / DELETE per article
# ─────────────────────────────────────────────────────────────
files['src/app/api/kb/[id]/route.ts'] = """\
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
    .replace(/[^\\w\\s-]/g, '').replace(/\\s+/g, '-').replace(/-+/g, '-').trim()
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
"""

# ─────────────────────────────────────────────────────────────
# 2. Admin KB list  /admin/kb/page.tsx
# ─────────────────────────────────────────────────────────────
files['src/app/(admin)/admin/kb/page.tsx'] = """\
'use client'
import { useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Plus, Search, Pencil, Trash2, Eye, EyeOff, Tag } from 'lucide-react'

const CATEGORIES = ['Sieť','Email','VPN','Windows','Hardware','Bezpečnosť','Zálohovanie','Iné']
const CAT_COLORS: Record<string,string> = {
  'Sieť':'bg-blue-100 text-blue-700','Email':'bg-purple-100 text-purple-700',
  'VPN':'bg-indigo-100 text-indigo-700','Windows':'bg-sky-100 text-sky-700',
  'Hardware':'bg-orange-100 text-orange-700','Bezpečnosť':'bg-red-100 text-red-700',
  'Zálohovanie':'bg-green-100 text-green-700','Iné':'bg-gray-100 text-gray-600',
}

function fmtDate(d:string){return new Date(d).toLocaleDateString('sk-SK')}

export default function AdminKbPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const router = useRouter()
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [deleting, setDeleting] = useState<string|null>(null)

  const { data: articles=[], isLoading } = useQuery({
    queryKey: ['kb-admin'],
    queryFn: () => fetch('/api/kb?all=1').then(r=>r.json()),
  })

  const deleteMut = useMutation({
    mutationFn: (id:string) => fetch(`/api/kb/${id}`,{method:'DELETE'}).then(r=>r.json()),
    onSuccess: () => { qc.invalidateQueries({queryKey:['kb-admin']}); setDeleting(null) }
  })

  const togglePublish = async (a:any) => {
    await fetch(`/api/kb/${a.id}`,{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({...a, isPublished:!a.isPublished})
    })
    qc.invalidateQueries({queryKey:['kb-admin']})
  }

  const filtered = useMemo(()=>articles.filter((a:any)=>{
    const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase()) || (a.tags||'').toLowerCase().includes(search.toLowerCase())
    const matchCat = !catFilter || a.category === catFilter
    const matchStatus = !statusFilter || (statusFilter==='published' ? a.isPublished : !a.isPublished)
    return matchSearch && matchCat && matchStatus
  }),[articles, search, catFilter, statusFilter])

  if (role !== 'ADMIN' && role !== 'AGENT') return null

  return (
    <PortalLayout>
      <div className="max-w-6xl mx-auto py-8 px-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BookOpen size={22} className="text-sycom-500"/> Znalostná báza
            </h1>
            <p className="text-sm text-gray-500 mt-1">Správa článkov a návodov</p>
          </div>
          <button onClick={()=>router.push('/admin/kb/new')}
            className="flex items-center gap-2 px-4 py-2.5 bg-sycom-500 text-white text-sm font-semibold rounded-xl hover:bg-sycom-600 transition-colors">
            <Plus size={16}/> Nový článok
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            {label:'Všetky', count:articles.length, color:'text-gray-700'},
            {label:'Publikované', count:articles.filter((a:any)=>a.isPublished).length, color:'text-green-600'},
            {label:'Koncepty', count:articles.filter((a:any)=>!a.isPublished).length, color:'text-amber-600'},
          ].map(s=>(
            <div key={s.label} className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
              <p className={`text-3xl font-bold ${s.color}`}>{s.count}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-6 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Hľadať..."
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/>
          </div>
          <select value={catFilter} onChange={e=>setCatFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none bg-white">
            <option value="">Všetky kategórie</option>
            {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none bg-white">
            <option value="">Všetky stavy</option>
            <option value="published">Publikované</option>
            <option value="draft">Koncepty</option>
          </select>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="py-16 text-center text-gray-400 text-sm">Načítavam...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              {articles.length === 0 ? 'Žiadne články — vytvorte prvý!' : 'Žiadne výsledky'}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map((a:any)=>(
                <div key={a.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${CAT_COLORS[a.category]??'bg-gray-100 text-gray-600'}`}>{a.category||'Iné'}</span>
                      {!a.isPublished && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Koncept</span>}
                      {a.tags && a.tags.split(',').slice(0,2).map((t:string)=>(
                        <span key={t} className="text-[11px] text-gray-400 flex items-center gap-0.5"><Tag size={9}/>{t.trim()}</span>
                      ))}
                    </div>
                    <p className="font-semibold text-gray-900 truncate">{a.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{fmtDate(a.updatedAt)}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={()=>togglePublish(a)} title={a.isPublished?'Skryť':'Publikovať'}
                      className={`p-1.5 rounded-lg transition-colors ${a.isPublished?'text-green-600 hover:bg-green-50':'text-gray-400 hover:bg-gray-100'}`}>
                      {a.isPublished ? <Eye size={15}/> : <EyeOff size={15}/>}
                    </button>
                    <button onClick={()=>router.push(`/admin/kb/${a.id}`)}
                      className="p-1.5 text-gray-400 hover:text-sycom-600 hover:bg-sycom-50 rounded-lg transition-colors">
                      <Pencil size={15}/>
                    </button>
                    {role==='ADMIN' && (
                      <button onClick={()=>setDeleting(a.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={15}/>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {deleting && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full mx-4">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Vymazať článok?</h3>
              <p className="text-sm text-gray-500 mb-5">Táto akcia je nevratná.</p>
              <div className="flex gap-3 justify-end">
                <button onClick={()=>setDeleting(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">Zrušiť</button>
                <button onClick={()=>deleteMut.mutate(deleting!)} disabled={deleteMut.isPending}
                  className="px-4 py-2 text-sm font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 disabled:opacity-50">
                  {deleteMut.isPending ? 'Mazanie...' : 'Vymazať'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  )
}
"""

# ─────────────────────────────────────────────────────────────
# 3. Admin KB editor  /admin/kb/[id]/page.tsx  (new + edit)
# ─────────────────────────────────────────────────────────────
files['src/app/(admin)/admin/kb/[id]/page.tsx'] = """\
'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { BookOpen, Save, Eye, EyeOff, ArrowLeft, Tag, Bold, List, Code, Heading2 } from 'lucide-react'

const CATEGORIES = ['Sieť','Email','VPN','Windows','Hardware','Bezpečnosť','Zálohovanie','Iné']

export default function KbEditPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  const isNew = id === 'new'

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState('Iné')
  const [tags, setTags] = useState('')
  const [isPublished, setIsPublished] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!isNew) {
      fetch(`/api/kb/${id}`).then(r=>r.json()).then(d=>{
        if (d.id) { setTitle(d.title); setBody(d.body); setCategory(d.category||'Iné'); setTags(d.tags||''); setIsPublished(d.isPublished) }
        setLoaded(true)
      })
    } else { setLoaded(true) }
  }, [id, isNew])

  const insertMd = (before:string, after='', placeholder='text') => {
    const ta = document.getElementById('kb-body') as HTMLTextAreaElement
    if (!ta) return
    const s = ta.selectionStart, e = ta.selectionEnd
    const sel = body.substring(s,e) || placeholder
    setBody(body.substring(0,s) + before + sel + after + body.substring(e))
    setTimeout(()=>{ ta.focus(); ta.setSelectionRange(s+before.length, s+before.length+sel.length) },10)
  }

  const renderPreview = (text:string) => text
    .replace(/^## (.+)$/gm,'<h2 class="text-lg font-bold text-gray-900 mt-4 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm,'<h1 class="text-xl font-bold text-gray-900 mt-5 mb-3">$1</h1>')
    .replace(/\\*\\*(.+?)\\*\\*/g,'<strong>$1</strong>')
    .replace(/`(.+?)`/g,'<code class="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-red-600">$1</code>')
    .replace(/^- (.+)$/gm,'<li class="ml-4 list-disc text-gray-700">$1</li>')
    .replace(/^\\d+\\. (.+)$/gm,'<li class="ml-4 list-decimal text-gray-700">$1</li>')
    .replace(/\\n\\n/g,'</p><p class="mb-3 text-gray-700">')

  const save = async (publish?: boolean) => {
    if (!title.trim() || !body.trim()) { setError('Vyplňte nadpis a obsah'); return }
    setSaving(true); setError('')
    const payload = { title, body, category, tags, isPublished: publish !== undefined ? publish : isPublished }
    const res = await fetch(isNew ? '/api/kb' : `/api/kb/${id}`, {
      method: isNew ? 'POST' : 'PUT',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) router.push('/admin/kb')
    else setError(data.error || 'Chyba pri ukladaní')
  }

  if (role !== 'ADMIN' && role !== 'AGENT') return null
  if (!loaded) return <PortalLayout><div className="py-16 text-center text-gray-400">Načítavam...</div></PortalLayout>

  return (
    <PortalLayout>
      <div className="max-w-5xl mx-auto py-8 px-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={()=>router.push('/admin/kb')} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors">
              <ArrowLeft size={18}/>
            </button>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <BookOpen size={20} className="text-sycom-500"/> {isNew ? 'Nový článok' : 'Upraviť článok'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=>setPreview(!preview)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl border transition-colors ${preview?'border-sycom-400 text-sycom-600 bg-sycom-50':'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              <Eye size={14}/> {preview ? 'Editor' : 'Náhľad'}
            </button>
            <button onClick={()=>save(false)} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 disabled:opacity-50">
              <Save size={14}/> Uložiť koncept
            </button>
            <button onClick={()=>save(true)} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-sycom-500 text-white rounded-xl hover:bg-sycom-600 disabled:opacity-50">
              <Eye size={14}/> Publikovať
            </button>
          </div>
        </div>

        {error && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Nadpis článku..."
                className="w-full text-xl font-bold text-gray-900 placeholder-gray-300 focus:outline-none"/>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              {!preview ? (
                <>
                  <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-100 bg-gray-50">
                    <button onClick={()=>insertMd('## ','','Nadpis')} title="Nadpis" className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors"><Heading2 size={14}/></button>
                    <button onClick={()=>insertMd('**','**','tučný')} title="Tučné" className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors"><Bold size={14}/></button>
                    <button onClick={()=>insertMd('`','`','kód')} title="Kód" className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors"><Code size={14}/></button>
                    <button onClick={()=>insertMd('- ','','položka')} title="Zoznam" className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors"><List size={14}/></button>
                    <div className="ml-auto text-xs text-gray-400">Markdown</div>
                  </div>
                  <textarea id="kb-body" value={body} onChange={e=>setBody(e.target.value)}
                    placeholder="Napíšte obsah článku... Podporuje Markdown.&#10;&#10;## Nadpis&#10;**tučné** `kód`&#10;- odrážky"
                    className="w-full p-4 text-sm text-gray-800 font-mono focus:outline-none resize-none leading-relaxed"
                    style={{minHeight:'420px'}}/>
                </>
              ) : (
                <div className="p-6 min-h-96 prose max-w-none text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{__html: body ? `<p class="mb-3 text-gray-700">${renderPreview(body)}</p>` : '<p class="text-gray-400">Zatiaľ žiadny obsah...</p>'}}/>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Stav</p>
              <button onClick={()=>setIsPublished(!isPublished)}
                className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-colors ${isPublished?'bg-green-100 text-green-700 hover:bg-green-200':'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}>
                {isPublished ? <><Eye size={14}/> Publikované</> : <><EyeOff size={14}/> Koncept</>}
              </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Kategória</p>
              <select value={category} onChange={e=>setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 bg-white">
                {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><Tag size={11}/> Tagy</p>
              <input value={tags} onChange={e=>setTags(e.target.value)} placeholder="vpn, heslo, outlook"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400"/>
              <p className="text-xs text-gray-400 mt-1.5">Oddeľte čiarkou</p>
              {tags && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {tags.split(',').filter((t:any)=>t.trim()).map((t:any)=>(
                    <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t.trim()}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Markdown tipy</p>
              <div className="space-y-1 text-xs text-gray-500 font-mono">
                <div># Nadpis 1</div>
                <div>## Nadpis 2</div>
                <div>**tučné**</div>
                <div>`inline kód`</div>
                <div>- odrážka</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PortalLayout>
  )
}
"""

# Write all files
for path, content in files.items():
    full_path = os.path.join(base, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Created: {path}')

# Also update the api/kb/route.ts to support ?all=1
route_path = os.path.join(base, 'src/app/api/kb/route.ts')
with open(route_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add all=1 support if not already there
if 'all=1' not in content and "searchParams.get('all')" not in content:
    old = "const where: any = {}"
    new = "const { searchParams } = new URL(req.url)\n  const all = searchParams.get('all') === '1'\n  const category = searchParams.get('category')\n  const search = searchParams.get('q')\n  const where: any = {}\n  if (!all) where.isPublished = true\n  if (category) where.category = category\n  if (search) where.OR = [{ title: { contains: search } }, { tags: { contains: search } }]"
    if old in content:
        content = content.replace(old, new)
        # remove duplicate searchParams line if it existed
        with open(route_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print('Updated: api/kb/route.ts')
    else:
        print('api/kb/route.ts already updated or different structure - skipping')
else:
    print('api/kb/route.ts already has ?all=1 support')

print('\nDone! Now run:')
print('npm run build && pm2 restart sycom-portal')
