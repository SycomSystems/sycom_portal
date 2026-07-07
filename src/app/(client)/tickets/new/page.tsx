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
import { Loader2, Send, Building2, Paperclip, X } from 'lucide-react'
import { FILE_ACCEPT, validateFile, formatFileSize } from '@/lib/attachments'

const schema = z.object({
  subject:     z.string().min(5, 'Min. 5 znakov').max(200),
  description: z.string().min(10, 'Min. 10 znakov'),
  category:    z.enum(['HARDWARE', 'SOFTWARE', 'NETWORK', 'EMAIL', 'SECURITY', 'CLOUD', 'ONBOARDING', 'OTHER']),
  clientId:    z.string().optional(),
  priority:    z.enum(['LOW', 'MEDIUM', 'HIGH']),
  assigneeId:  z.string().optional(),
})

type FormData = z.infer<typeof schema>

const PRIORITIES = [
  { value: 'LOW',      label: '🟢 Nízka',    desc: 'Všeobecná otázka, nie je urgentné' },
  { value: 'MEDIUM',   label: '🟡 Stredná',   desc: 'Práca obmedzená, ale funkčná' },
  { value: 'HIGH',     label: '🟠 Vysoká',    desc: 'Práca je zablokovaná' },
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
  const [files, setFiles] = useState<File[]>([])
  const [technicians, setTechnicians] = useState<{ id: string; name: string }[]>([])
  const [slaDate, setSlaDate] = useState<string>('')
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
  const selectedClientId = watch('clientId')

  // Set initial SLA date on client side (avoids SSR/client mismatch)
  useEffect(() => {
    const d = new Date()
    let added = 0
    while (added < 2) {
      d.setDate(d.getDate() + 1)
      const day = d.getDay()
      if (day !== 0 && day !== 6) added++
    }
    setSlaDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)
  }, [])

  // Fetch technicians (agents + admins) once on mount for staff
  useEffect(() => {
    if (!isStaff) { setTechnicians([]); setValue('assigneeId', ''); return }
    fetch('/api/users')
      .then(r => r.json())
      .then((users: any[]) => {
        const techs = users
          .filter((u: any) => u['role'] === 'AGENT' || u['role'] === 'ADMIN')
          .map((u: any) => ({ id: u['id'], name: u['name'] }))
        setTechnicians(techs)
      })
      .catch(() => {})
  }, [isStaff, setValue])

  // Update SLA date when priority changes
  useEffect(() => {
    const d = new Date()
    if (selectedPriority === 'HIGH') { d.setDate(d.getDate() + 1); setSlaDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`); return }
    const days = selectedPriority === 'LOW' ? 5 : 2
    let added = 0
    while (added < days) {
      d.setDate(d.getDate() + 1)
      const wd = d.getDay()
      if (wd !== 0 && wd !== 6) added++
    }
    setSlaDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)
  }, [selectedPriority])

  function addFiles(list: FileList | null) {
    if (!list) return
    const incoming = Array.from(list)
    const valid: File[] = []
    for (const f of incoming) {
      const check = validateFile(f.name, f.type, f.size)
      if (!check.ok) { toast.error(`${f.name}: ${check.error}`); continue }
      valid.push(f)
    }
    if (valid.length) setFiles(prev => [...prev, ...valid])
  }

  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  async function uploadAttachments(ticketId: string) {
    if (files.length === 0) return
    const fd = new FormData()
    files.forEach(f => fd.append('files', f))
    const res = await fetch(`/api/tickets/${ticketId}/attachments`, { method: 'POST', body: fd })
    if (!res.ok) throw new Error('upload failed')
  }

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
      if (data.assigneeId) body.assigneeId = data.assigneeId
      body.slaDeadline = slaDate

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
      try {
        await uploadAttachments(ticket.id)
      } catch {
        toast.error('Tiket vytvorený, ale prílohy sa nepodarilo nahrať')
      }
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

          {/* Attachments */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Prílohy</label>
            <label className="flex items-center gap-2 w-fit cursor-pointer px-3 py-2 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-sycom-400 hover:text-sycom-500 transition-colors">
              <Paperclip size={14} /> Pridať súbory
              <input type="file" multiple accept={FILE_ACCEPT} className="hidden"
                onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
            </label>
            <p className="text-[11px] text-gray-400 mt-1.5">Obrázky, PDF, Office, ZIP a pod. — max. 10 MB na súbor.</p>
            {files.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-sm bg-gray-50 rounded-xl px-3 py-2">
                    <span className="flex items-center gap-2 min-w-0">
                      <Paperclip size={13} className="text-gray-400 shrink-0" />
                      <span className="truncate text-gray-700">{f.name}</span>
                      <span className="text-xs text-gray-400 shrink-0">{formatFileSize(f.size)}</span>
                    </span>
                    <button type="button" onClick={() => removeFile(i)} className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
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
              {/* Assignee technician — staff only */}
              {isStaff && (
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Pridelený technik</label>
                  <select {...register('assigneeId')} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 bg-white">
                    <option value="">— Automaticky —</option>
                    {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
              {/* SLA deadline — staff only */}
              {isStaff && (
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">SLA termín</label>
                  <input type="date" value={slaDate} onChange={e => setSlaDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sycom-400 bg-white" />
                </div>
              )}
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
