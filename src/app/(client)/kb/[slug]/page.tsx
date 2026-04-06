'use client'
// src/app/(client)/kb/[slug]/page.tsx
import { useQuery, useMutation } from '@tanstack/react-query'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { useParams } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { ChevronLeft, Eye, Calendar, Tag, Ticket } from 'lucide-react'
import Link from 'next/link'

// Simple markdown → HTML (no external lib needed)
function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold text-gray-800 mt-5 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2 class="text-lg font-bold text-gray-800 mt-6 mb-2 pb-2 border-b border-gray-200">$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1 class="text-xl font-bold text-sycom-500 mt-4 mb-3">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-gray-800">$1</strong>')
    .replace(/\*(.+?)\*/g,    '<em class="italic">$1</em>')
    .replace(/`(.+?)`/g,      '<code class="font-mono text-xs bg-gray-100 text-sycom-600 px-1.5 py-0.5 rounded">$1</code>')
    .replace(/^\- (.+)$/gm,   '<li class="flex items-start gap-2 text-sm text-gray-700 py-0.5"><span class="text-sycom-500 mt-0.5">•</span><span>$1</span></li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="flex items-start gap-2 text-sm text-gray-700 py-0.5"><span class="text-sycom-500 font-bold min-w-[18px]">$1.</span><span>$2</span></li>')
    .replace(/(<li.*<\/li>\n?)+/g, '<ul class="space-y-0.5 my-3 ml-1">$&</ul>')
    .replace(/^(?!<[h|u|l|c])(.+)$/gm, '<p class="text-sm text-gray-700 leading-relaxed my-2">$1</p>')
    .replace(/\n\n/g, '')
}

export default function KbArticlePage() {
  const { slug } = useParams()

  const { data, isLoading } = useQuery({
    queryKey: ['kb-article', slug],
    queryFn:  async () => {
      const res = await fetch(`/api/kb?search=${slug}`)
      const json = await res.json()
      // increment view count
      await fetch(`/api/kb/${slug}/view`, { method: 'POST' }).catch(() => {})
      return json.articles?.find((a: any) => a.slug === slug) ?? null
    },
  })

  if (isLoading) return (
    <PortalLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-sycom-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </PortalLayout>
  )

  if (!data) return (
    <PortalLayout>
      <div className="text-center py-20">
        <p className="text-gray-400 font-semibold">Článok nenájdený</p>
        <Link href="/kb" className="btn btn-ghost mt-4">← Späť na znalostná báza</Link>
      </div>
    </PortalLayout>
  )

  return (
    <PortalLayout>
      <div className="max-w-3xl mx-auto">

        {/* Back */}
        <Link href="/kb" className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-sycom-500 transition-colors mb-5">
          <ChevronLeft size={14} /> Späť na znalostná báza
        </Link>

        {/* Article card */}
        <div className="card">
          <div className="card-stripe" />

          {/* Article header */}
          <div className="p-6 border-b border-gray-100">
            {data.category && (
              <div className="flex items-center gap-2 mb-3">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center text-base"
                  style={{ background: (data.category.color ?? '#1a6fba') + '18' }}>
                  {data.category.icon}
                </span>
                <span className="text-xs font-semibold text-gray-400">{data.category.name}</span>
              </div>
            )}
            <h1 className="text-2xl font-bold text-gray-800 mb-3 tracking-tight">{data.title}</h1>
            <div className="flex items-center gap-4 text-[11px] font-mono text-gray-400">
              <span className="flex items-center gap-1"><Calendar size={10}/> {formatDate(data.updatedAt)}</span>
              <span className="flex items-center gap-1"><Eye size={10}/> {data.viewCount} zobrazení</span>
              {data.category && (
                <span className="flex items-center gap-1"><Tag size={10}/> {data.category.name}</span>
              )}
            </div>
          </div>

          {/* Article content */}
          <div className="p-6">
            <div
              className="prose-sycom"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(data.content) }}
            />
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
            <p className="text-xs text-gray-400">Pomohol vám tento článok?</p>
            <div className="flex gap-2">
              <button className="btn btn-ghost btn-sm">👍 Áno</button>
              <button className="btn btn-ghost btn-sm">👎 Nie</button>
            </div>
          </div>
        </div>

        {/* Still need help? */}
        <div className="mt-5 p-5 bg-sycom-50 border border-sycom-200 rounded-xl flex items-center gap-4">
          <div className="w-10 h-10 bg-sycom-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <Ticket size={18} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-800">Stále máte problém?</p>
            <p className="text-xs text-gray-500 mt-0.5">Náš tím je tu pre vás — vytvorte tiket a ozve sa vám technik.</p>
          </div>
          <Link href="/tickets/new" className="btn btn-primary btn-sm flex-shrink-0">
            Vytvoriť tiket
          </Link>
        </div>
      </div>
    </PortalLayout>
  )
}
