'use client'
// src/app/(client)/tickets/new/page.tsx
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { Loader2, Send, Building2 } from 'lucide-react'

const schema = z.object({
  subject:     z.string().min(5, 'Min. 5 znakov').max(200),
  description: z.string().min(10, 'Min. 10 znakov'),
  priority:    z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  category:    z.enum(['HARDWARE', 'SOFTWARE', 'NETWORK', 'EMAIL', 'SECURITY', 'CLOUD', 'ONBOARDING', 'OTHER']),
  clientId:    z.string().optional(),
})

type FormData = z.infer<typeof schema>

const PRIORITIES = [
  { value: 'LOW',      label: '🟢 Nízka',    desc: 'Všeobecná otázka, nie je urgentné' },
  { value: 'MEDIUM',   label: '🟡 Stredná',   desc: 'Práca obmedzená, ale funkčná' },
  { value: 'HIGH',     label: '🟠 Vysoká',    desc: 'Práca je zablokovaná' },
  { value: 'CRITICAL', label: '🔴 Kritická',  desc: 'Systém nefunguje, kritický dopad' },
]

const CATEGORIES = [
  { value: 'HARDWARE',  label: 'Hardware' },
  { value: 'SOFTWARE',  label: 'Software' },
  { value: 'NETWORK',   label: 'Sieť' },
  { value: 'EMAIL',     label: 'Email' },
  { value: 'SECURITY',  label: 'Bezpečnosť' },
  { value: 'CLOUD',     label: 'Cloud' },
  { value: 'ONBOARDING',label: 'Onboarding' },
  { value: 'OTHER',     label: 'Iné' },
]

export default function NewTicketPage() {
  const router              = useRouter()
  const { data: session }   = useSession()
  const role                = (session?.user as any)?.role
  const userClientId        = (session?.user as any)?.clientId
  const isStaff             = role === 'ADMIN' || role === 'AGENT'

  const [loading,  setLoading]  = useState(false)
  const [clients,  setClients]  = useState<{ id: string; name: string }[]>([])

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'MEDIUM', category: 'OTHER' },
  })

  // Fetch clients list for ADMIN/AGENT dropdown
  useEffect(() => {
    if (isStaff) {
      fetch('/api/clients').then(r => r.json()).then(setClients).catch(() => {})
    }
  }, [isStaff])

  // For CLIENT/CLIENT_MANAGER — auto-set their own clientId
  useEffect(() => {
    if (!isStaff && userClientId) {
      setValue('clientId', userClientId)
    }
  }, [isStaff, userClientId, setValue])

  const selectedPriority = watch('priority')

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      const body: any = {
        subject:     data.subject,
        description: data.description,
        priority:    data.priority,
        category:    data.category,
      }
      // Pass clientId as department field (mapped in API) or directly
      if (data.clientId) body.clientId = data.clientId

      const res = await fetch('/api/tickets', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Chyba pri vytváraní tiketu')
      }
      const ticket = await res.json()
      toast.success('Tiket bol vytvorený!')
      router.push(`/tickets/${ticket.id}`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <PortalLayout>
      <div className="max-w-2xl mx-auto py-8 px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Nový tiket</h1>
          <p className="text-sm text-gray-500 mt-1">Vyplňte formulár a odošlite požiadavku na podporu</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

          {/* Subject */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Predmet *</label>
            <input
              {...register('subject')}
              placeholder="Stručný popis problému..."
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 focus:ring-2 focus:ring-sycom-100"
            />
            {errors.subject && <p className="text-xs text-red-500 mt-1">{errors.subject.message}</p>}
          </div>

          {/* Description */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Popis *</label>
            <textarea
              {...register('description')}
              placeholder="Podrobný popis problému, kroky na reprodukciu, čo ste očakávali..."
              rows={5}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:border-sycom-400 focus:ring-2 focus:ring-sycom-100"
            />
            {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}
          </div>

          {/* Priority + Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Priorita *</label>
              <div className="space-y-2">
                {PRIORITIES.map(p => (
                  <label key={p.value} className={`flex items-start gap-3 p-2.5 rounded-xl cursor-pointer border transition-all ${selectedPriority === p.value ? 'border-sycom-400 bg-sycom-50' : 'border-transparent hover:bg-gray-50'}`}>
                    <input type="radio" value={p.value} {...register('priority')} className="mt-0.5 accent-sycom-500" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{p.label}</p>
                      <p className="text-[11px] text-gray-400">{p.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Kategória *</label>
                <select {...register('category')}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 bg-white">
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              {/* Client — dropdown for ADMIN/AGENT, read-only label for CLIENT */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Building2 size={12} /> Klient
                </label>
                {isStaff ? (
                  <select {...register('clientId')}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 bg-white">
                    <option value="">— Vybrať klienta —</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                ) : userClientId ? (
                  <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                    <Building2 size={13} className="text-sycom-500" />
                    {(session?.user as any)?.clientName ?? 'Váš klient'}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400">Žiadny klient priradený</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => router.back()}
              className="px-5 py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
              Zrušiť
            </button>
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-sycom-500 text-white text-sm font-bold rounded-xl hover:bg-sycom-600 disabled:opacity-50 transition-colors">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {loading ? 'Odosielam...' : 'Odoslať tiket'}
            </button>
          </div>
        </form>
      </div>
    </PortalLayout>
  )
}
