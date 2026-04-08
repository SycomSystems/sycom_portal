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
