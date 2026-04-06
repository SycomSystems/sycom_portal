'use client'
// src/app/(client)/tickets/new/page.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { Loader2, Send } from 'lucide-react'

const schema = z.object({
  subject:     z.string().min(5, 'Min. 5 znakov').max(200),
  description: z.string().min(10, 'Min. 10 znakov'),
  priority:    z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  category:    z.enum(['HARDWARE', 'SOFTWARE', 'NETWORK', 'EMAIL', 'SECURITY', 'CLOUD', 'ONBOARDING', 'OTHER']),
  department:  z.string().optional(),
})

type FormData = z.infer<typeof schema>

const PRIORITIES = [
  { value: 'LOW',      label: '🟢 Nízka',     desc: 'Všeobecná otázka, nie je urgentné' },
  { value: 'MEDIUM',   label: '🟡 Stredná',    desc: 'Práca obmedzená, ale funkčná' },
  { value: 'HIGH',     label: '🟠 Vysoká',     desc: 'Práca je zablokovaná' },
  { value: 'CRITICAL', label: '🔴 Kritická',   desc: 'Systém nefunguje, kritický dopad' },
]

export default function NewTicketPage() {
  const router  = useRouter()
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'MEDIUM', category: 'OTHER' },
  })

  const selectedPriority = watch('priority')

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      const res = await fetch('/api/tickets', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      const ticket = await res.json()
      toast.success(`Tiket #T-${ticket.ticketNumber} bol vytvorený!`)
      router.push(`/tickets/${ticket.ticketNumber}`)
    } catch {
      toast.error('Chyba pri vytváraní tiketu')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PortalLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Nový tiket</h1>
          <p className="text-sm text-gray-400 mt-0.5">Popíšte problém a náš tím sa vám ozve čo najskôr</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="card mb-4">
            <div className="card-stripe" />
            <div className="card-header">
              <span className="card-title">Detaily tiketu</span>
            </div>
            <div className="p-6 space-y-5">

              <div>
                <label className="label">Predmet *</label>
                <input {...register('subject')} className="input" placeholder="Stručný popis problému" />
                {errors.subject && <p className="text-xs text-red-500 mt-1">{errors.subject.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Kategória *</label>
                  <select {...register('category')} className="input">
                    <option value="HARDWARE">🖥️ Hardvér</option>
                    <option value="SOFTWARE">💻 Softvér</option>
                    <option value="NETWORK">🌐 Sieť / VPN</option>
                    <option value="EMAIL">📧 Email / Kalendár</option>
                    <option value="SECURITY">🔐 Bezpečnosť</option>
                    <option value="CLOUD">☁️ Cloud / O365</option>
                    <option value="ONBOARDING">👋 Onboarding</option>
                    <option value="OTHER">❓ Iné</option>
                  </select>
                </div>
                <div>
                  <label className="label">Oddelenie</label>
                  <select {...register('department')} className="input">
                    <option value="">— Vyberte —</option>
                    <option>IT</option>
                    <option>Predaj</option>
                    <option>HR</option>
                    <option>Účtovníctvo</option>
                    <option>Výroba</option>
                    <option>Management</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Popis problému *</label>
                <textarea {...register('description')} className="input min-h-[130px] resize-y"
                  placeholder="Popíšte problém podrobne. Uveďte: kroky na reprodukciu, chybové hlásenia, čo ste už skúšali…" />
                {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}
              </div>
            </div>
          </div>

          {/* Priority picker */}
          <div className="card mb-6">
            <div className="card-stripe" />
            <div className="card-header">
              <span className="card-title">Priorita *</span>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              {PRIORITIES.map(p => (
                <label key={p.value} className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all
                  ${selectedPriority === p.value
                    ? 'border-sycom-500 bg-sycom-50'
                    : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <input type="radio" {...register('priority')} value={p.value} className="mt-0.5 accent-sycom-500" />
                  <div>
                    <p className="text-sm font-bold text-gray-800">{p.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{p.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => router.back()} className="btn btn-ghost">Zrušiť</button>
            <button type="submit" disabled={loading} className="btn btn-primary px-6">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {loading ? 'Odosielam...' : 'Odoslať tiket'}
            </button>
          </div>
        </form>
      </div>
    </PortalLayout>
  )
}
