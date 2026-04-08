'use client'
import { useQuery } from '@tanstack/react-query'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ChevronLeft, Tag, Calendar, Pencil } from 'lucide-react'

function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold text-gray-800 mt-5 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2 class="text-lg font-bold text-gray-800 mt-6 mb-2 pb-2 border-b border-gray-200">$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1 class="text-xl font-bold text-sycom-700 mt-4 mb-3">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-900 text-green-400 p-4 rounded-xl text-sm font-mono overflow-x-auto my-3 whitespace-pre-wrap">$1</pre>')
    .replace(/`(.+?)`/g, '<code class="bg-gray-100 text-red-600 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-5 list-disc text-gray-700 my-0.5">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-5 list-decimal text-gray-700 my-0.5">$1</li>')
    .replace(/^(?!<[hlp]|<li|<pre|<code)(.+)$/gm, '<p class="text-gray-700 leading-relaxed my-2">$1</p>')
    .replace(/\n{2,}/g, '')
}

function fmtDate(d: string) { return new Date(d).toLocaleDateString('sk-SK') }

export default function KbArticlePage() {
  const { slug } = useParams() as { slug: string }
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const router = useRouter()
  const isStaff = role === 'ADMIN' || role === 'AGENT'

  const { data: article, isLoading } = useQuery({
    queryKey: ['kb-article', slug],
    queryFn: async () => {
      // Fetch all published articles and find by slug
      const res = await fetch(`/api/kb?all=1`)
      const arr = await res.json()
      if (!Array.isArray(arr)) return null
      const found = arr.find((a: any) => a.slug === slug)
      if (!found) return null
      // Fetch full article with body
      const res2 = await fetch(`/api/kb/${found.id}`)
      if (!res2.ok) return null
      return res2.json()
    },
    enabled: isStaff,
  })

  if (!isStaff) return (
    <PortalLayout>
      <div className="max-w-2xl mx-auto py-20 text-center">
        <p className="text-gray-500">Táto sekcia je dostupná iba pre pracovníkov podpory.</p>
      </div>
    </PortalLayout>
  )

  return (
    <PortalLayout>
      <div className="max-w-3xl mx-auto py-8 px-6">
        <button onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
          <ChevronLeft size={16}/> Späť na znalostná báza
        </button>

        {isLoading ? (
          <div className="py-20 text-center text-gray-400">Načítavam...</div>
        ) : !article ? (
          <div className="py-20 text-center">
            <p className="text-gray-500 text-lg font-medium mb-2">Článok nenájdený</p>
            <button onClick={() => router.push('/kb')} className="text-sycom-500 text-sm hover:underline">← Späť na znalostná báza</button>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="p-8 pb-6 border-b border-gray-100">
              <div className="flex items-start justify-between gap-4 mb-4">
                <h1 className="text-2xl font-bold text-gray-900 leading-snug">{article.title}</h1>
                {isStaff && (
                  <button onClick={() => router.push(`/admin/kb/${article.id}`)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sycom-600 bg-sycom-50 border border-sycom-200 rounded-xl hover:bg-sycom-100 transition-colors">
                    <Pencil size={12}/> Upraviť
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                {article.category && (
                  <span className="bg-sycom-50 text-sycom-700 font-semibold px-2.5 py-1 rounded-full">{article.category}</span>
                )}
                <span className="flex items-center gap-1"><Calendar size={11}/>{fmtDate(article.updatedAt)}</span>
                {article.tags && article.tags.split(',').map((t: string) => (
                  <span key={t} className="flex items-center gap-0.5 text-gray-400"><Tag size={10}/>{t.trim()}</span>
                ))}
              </div>
            </div>

            {/* Body */}
            <div className="p-8 prose max-w-none"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(article.body || '') }}/>
          </div>
        )}
      </div>
    </PortalLayout>
  )
}
