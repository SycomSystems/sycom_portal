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
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/`(.+?)`/g,'<code class="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-red-600">$1</code>')
    .replace(/^- (.+)$/gm,'<li class="ml-4 list-disc text-gray-700">$1</li>')
    .replace(/^\d+\. (.+)$/gm,'<li class="ml-4 list-decimal text-gray-700">$1</li>')
    .replace(/\n\n/g,'</p><p class="mb-3 text-gray-700">')

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
