'use client'
// src/app/(client)/kb/page.tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { Search, BookOpen, Eye, ChevronRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export default function KbPage() {
  const [search,     setSearch]     = useState('')
  const [categoryId, setCategoryId] = useState('')

  const params = new URLSearchParams()
  if (search)     params.set('search', search)
  if (categoryId) params.set('categoryId', categoryId)

  const { data, isLoading } = useQuery({
    queryKey: ['kb', search, categoryId],
    queryFn:  () => fetch(`/api/kb?${params}`).then(r => r.json()),
  })

  const articles   = data?.articles   ?? []
  const categories = data?.categories ?? []

  return (
    <PortalLayout>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Znalostná báza</h1>
        <p className="text-sm text-gray-400 mt-0.5">Návody, riešenia a odpovede na časté otázky</p>
      </div>

      {/* Hero search */}
      <div className="bg-gradient-to-br from-sycom-500 to-sycom-700 rounded-2xl p-8 mb-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className="relative z-10 max-w-xl mx-auto text-center">
          <BookOpen size={32} className="mx-auto mb-3 text-white/80" />
          <h2 className="text-xl font-bold text-white mb-1">Ako vám môžeme pomôcť?</h2>
          <p className="text-sm text-white/70 mb-5">Prehľadajte naše návody a dokumentáciu</p>
          <div className="relative">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="w-full bg-white rounded-xl py-3 pl-10 pr-4 text-sm text-gray-800 outline-none shadow-lg placeholder:text-gray-400
                         focus:ring-2 focus:ring-white/30"
              placeholder="Hľadať článok, napr. VPN, Outlook, heslo…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Category filters */}
      <div className="flex gap-2 flex-wrap mb-6">
        <button
          onClick={() => setCategoryId('')}
          className={cn(
            'text-xs font-semibold px-4 py-2 rounded-full border transition-all',
            categoryId === ''
              ? 'bg-sycom-500 text-white border-sycom-500 shadow-sm'
              : 'bg-white text-gray-500 border-gray-300 hover:border-sycom-400 hover:text-sycom-500'
          )}>
          📚 Všetky
        </button>
        {categories.map((cat: any) => (
          <button
            key={cat.id}
            onClick={() => setCategoryId(cat.id)}
            className={cn(
              'text-xs font-semibold px-4 py-2 rounded-full border transition-all',
              categoryId === cat.id
                ? 'bg-sycom-500 text-white border-sycom-500 shadow-sm'
                : 'bg-white text-gray-500 border-gray-300 hover:border-sycom-400 hover:text-sycom-500'
            )}>
            {cat.icon} {cat.name}
          </button>
        ))}
      </div>

      {/* Category cards (when no search/filter active) */}
      {!search && !categoryId && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {categories.map((cat: any) => (
            <button
              key={cat.id}
              onClick={() => setCategoryId(cat.id)}
              className="card p-5 text-left hover:border-sycom-400 hover:-translate-y-1 transition-all group cursor-pointer">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-3"
                style={{ background: cat.color + '18' }}>
                {cat.icon}
              </div>
              <p className="text-sm font-bold text-gray-800 mb-1 group-hover:text-sycom-500 transition-colors">{cat.name}</p>
              <p className="text-xs text-gray-400">{cat.description ?? 'Prehľadajte články'}</p>
              <div className="flex items-center gap-1 text-xs text-sycom-500 font-semibold mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                Zobraziť články <ChevronRight size={12} />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Articles list */}
      {(search || categoryId) && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            {articles.length} {articles.length === 1 ? 'článok' : 'článkov'}
          </p>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-sycom-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : articles.length === 0 ? (
            <div className="card p-12 text-center">
              <BookOpen size={32} className="mx-auto mb-3 text-gray-300" />
              <p className="text-gray-400 font-semibold">Žiadne články nenájdené</p>
              <p className="text-xs text-gray-400 mt-1">Skúste iné kľúčové slovo alebo kontaktujte helpdesk</p>
            </div>
          ) : (
            <div className="space-y-3">
              {articles.map((art: any) => (
                <Link key={art.id} href={`/kb/${art.slug}`}
                  className="card flex items-start gap-4 p-5 hover:border-sycom-400 hover:bg-sycom-50 transition-all group">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: (art.category?.color ?? '#1a6fba') + '18' }}>
                    {art.category?.icon ?? '📄'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 group-hover:text-sycom-500 transition-colors mb-0.5">
                      {art.title}
                    </p>
                    {art.excerpt && (
                      <p className="text-xs text-gray-500 line-clamp-2">{art.excerpt}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-[11px] font-mono text-gray-400">
                      <span className="flex items-center gap-1"><Eye size={10}/> {art.viewCount}</span>
                      <span>·</span>
                      <span>{formatDate(art.updatedAt)}</span>
                      {art.category && (
                        <>
                          <span>·</span>
                          <span>{art.category.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-sycom-500 transition-colors mt-1 flex-shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Popular articles (shown when no filter) */}
      {!search && !categoryId && articles.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">🔥 Najčítanejšie články</p>
          <div className="space-y-2">
            {articles.slice(0, 5).map((art: any) => (
              <Link key={art.id} href={`/kb/${art.slug}`}
                className="card flex items-center gap-4 px-5 py-3.5 hover:border-sycom-400 hover:bg-sycom-50 transition-all group">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                  style={{ background: (art.category?.color ?? '#1a6fba') + '18' }}>
                  {art.category?.icon ?? '📄'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 group-hover:text-sycom-500 transition-colors truncate">{art.title}</p>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-mono text-gray-400 flex-shrink-0">
                  <Eye size={10}/> {art.viewCount}
                </div>
                <ChevronRight size={14} className="text-gray-300 group-hover:text-sycom-500 transition-colors flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </PortalLayout>
  )
}
