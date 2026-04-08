'use client'
import { useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, Search, ChevronRight, Tag, Plus } from 'lucide-react'

const CATEGORIES = ['Sieť', 'Email', 'VPN', 'Windows', 'Hardware', 'Bezpečnosť', 'Zálohovanie', 'Iné']
const CAT_COLORS: Record<string,string> = {
  'Sieť':'bg-blue-100 text-blue-700','Email':'bg-purple-100 text-purple-700',
  'VPN':'bg-indigo-100 text-indigo-700','Windows':'bg-sky-100 text-sky-700',
  'Hardware':'bg-orange-100 text-orange-700','Bezpečnosť':'bg-red-100 text-red-700',
  'Zálohovanie':'bg-green-100 text-green-700','Iné':'bg-gray-100 text-gray-600',
}
const CAT_ICONS: Record<string,string> = {
  'Sieť':'🌐','Email':'📧','VPN':'🔒','Windows':'🖥️',
  'Hardware':'🖨️','Bezpečnosť':'🛡️','Zálohovanie':'💾','Iné':'📄',
}

export default function KbPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState('')
  const isStaff = role === 'ADMIN' || role === 'AGENT'

  const { data: articles=[], isLoading } = useQuery({
    queryKey: ['kb-published'],
    queryFn: () => fetch('/api/kb').then(r=>r.json()).then(d=>Array.isArray(d)?d:[]),
    enabled: isStaff,
  })

  const filtered = useMemo(()=>articles.filter((a:any)=>{
    const matchCat = !activeCat || a.category === activeCat
    const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase()) || (a.tags||'').toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  }), [articles, activeCat, search])

  const byCategory = useMemo(()=>{
    const groups: Record<string, any[]> = {}
    filtered.forEach((a:any)=>{ const cat = a.category||'Iné'; if(!groups[cat]) groups[cat]=[]; groups[cat].push(a) })
    return groups
  }, [filtered])

  if (!session) return null

  if (!isStaff) return (
    <PortalLayout>
      <div className="max-w-2xl mx-auto py-20 text-center px-6">
        <BookOpen size={40} className="text-gray-300 mx-auto mb-4"/>
        <h2 className="text-xl font-bold text-gray-700 mb-2">Znalostná báza</h2>
        <p className="text-gray-500 text-sm">Táto sekcia je dostupná iba pre pracovníkov podpory.</p>
      </div>
    </PortalLayout>
  )

  return (
    <PortalLayout>
      <div className="w-full py-8 px-6">
        <div className="bg-gradient-to-br from-sycom-600 to-sycom-800 rounded-3xl p-8 mb-8 text-white">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3"><BookOpen size={24}/><h1 className="text-2xl font-bold">Znalostná báza</h1></div>
              <p className="text-sycom-100 mb-5">Návody, riešenia a dokumentácia pre tím podpory</p>
              <div className="relative max-w-lg">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Hľadať článok, napr. VPN, Outlook, heslo..."
                  className="w-full pl-10 pr-4 py-3 bg-white text-gray-900 rounded-2xl text-sm focus:outline-none placeholder-gray-400 shadow-lg"/>
              </div>
            </div>
            {role==='ADMIN'||role==='AGENT' ? (
              <button onClick={()=>router.push('/admin/kb')}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold rounded-xl transition-colors">
                <Plus size={15}/> Správa článkov
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <button onClick={()=>setActiveCat('')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${!activeCat?'bg-sycom-500 text-white':'bg-white border border-gray-200 text-gray-600 hover:border-sycom-300'}`}>
            Všetky {!activeCat && articles.length > 0 && `(${articles.length})`}
          </button>
          {CATEGORIES.filter(c=>articles.some((a:any)=>a.category===c)).map(c=>(
            <button key={c} onClick={()=>setActiveCat(c===activeCat?'':c)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeCat===c?'bg-sycom-500 text-white':'bg-white border border-gray-200 text-gray-600 hover:border-sycom-300'}`}>
              {CAT_ICONS[c]} {c}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-gray-400">Načítavam...</div>
        ) : articles.length === 0 ? (
          <div className="py-16 text-center">
            <BookOpen size={40} className="text-gray-200 mx-auto mb-4"/>
            <p className="text-gray-500 text-sm mb-4">Zatiaľ žiadne články v znalostnej báze</p>
            <button onClick={()=>router.push('/admin/kb/new')} className="inline-flex items-center gap-2 px-4 py-2 bg-sycom-500 text-white text-sm font-semibold rounded-xl hover:bg-sycom-600">
              <Plus size={14}/> Pridať prvý článok
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">Žiadne výsledky pre &ldquo;{search}&rdquo;</div>
        ) : activeCat ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((a:any)=><ArticleCard key={a.id} article={a} router={router}/>)}
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(byCategory).map(([cat, arts])=>(
              <div key={cat}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{CAT_ICONS[cat]}</span>
                  <h2 className="text-base font-bold text-gray-800">{cat}</h2>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{arts.length}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {arts.map((a:any)=><ArticleCard key={a.id} article={a} router={router}/>)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  )
}

function ArticleCard({article:a, router}:any) {
  return (
    <button onClick={()=>router.push(`/kb/${a.slug}`)}
      className="w-full text-left bg-white border border-gray-200 rounded-2xl p-4 hover:border-sycom-300 hover:shadow-sm transition-all group">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-gray-900 text-sm leading-snug group-hover:text-sycom-600 transition-colors">{a.title}</p>
        <ChevronRight size={14} className="text-gray-300 group-hover:text-sycom-500 shrink-0 mt-0.5 transition-colors"/>
      </div>
      {a.tags && (
        <div className="flex flex-wrap gap-1 mt-2">
          {a.tags.split(',').slice(0,3).map((t:string)=>(
            <span key={t} className="text-[10px] text-gray-400 flex items-center gap-0.5"><Tag size={8}/>{t.trim()}</span>
          ))}
        </div>
      )}
    </button>
  )
}
