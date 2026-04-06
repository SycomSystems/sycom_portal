'use client'
// src/app/(admin)/admin/users/page.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Search, Plus, X, Loader2, UserCheck, UserX, Shield, Headphones, User } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

const schema = z.object({
  name:       z.string().min(2, 'Min. 2 znaky'),
  email:      z.string().email('Neplatný email'),
  password:   z.string().min(8, 'Min. 8 znakov'),
  role:       z.enum(['ADMIN', 'AGENT', 'CLIENT']),
  department: z.string().optional(),
  phone:      z.string().optional(),
})
type FormData = z.infer<typeof schema>

const ROLE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  ADMIN:  { label: 'Admin',   icon: <Shield size={11}/>,      color: '#7b3fbe', bg: '#f3eeff' },
  AGENT:  { label: 'Technik', icon: <Headphones size={11}/>,  color: '#1a6fba', bg: '#e8f2fc' },
  CLIENT: { label: 'Klient',  icon: <User size={11}/>,        color: '#2a9d5c', bg: '#edf9f3' },
}

export default function UsersPage() {
  const [search,  setSearch]  = useState('')
  const [role,    setRole]    = useState('Všetky')
  const [showModal, setShowModal] = useState(false)
  const queryClient = useQueryClient()

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', search, role],
    queryFn:  () => {
      const p = new URLSearchParams()
      if (search)           p.set('search', search)
      if (role !== 'Všetky') p.set('role', role)
      return fetch(`/api/users?${p}`).then(r => r.json())
    },
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'CLIENT' },
  })

  const createMutation = useMutation({
    mutationFn: (data: FormData) => fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(async r => {
      if (!r.ok) throw new Error((await r.json()).error ?? 'Chyba')
      return r.json()
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Používateľ vytvorený')
      setShowModal(false)
      reset()
    },
    onError: (e: any) => toast.error(e.message ?? 'Chyba pri vytváraní'),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Používateľ aktualizovaný')
    },
  })

  const ROLES = ['Všetky', 'ADMIN', 'AGENT', 'CLIENT']

  return (
    <PortalLayout>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Používatelia</h1>
          <p className="text-sm text-gray-400 mt-0.5">{users.length} používateľov celkom</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={14} /> Nový používateľ
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-5">
        <div className="p-4 flex gap-3 items-center flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9" placeholder="Hľadať podľa mena alebo emailu…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            {ROLES.map(r => (
              <button key={r}
                onClick={() => setRole(r)}
                className={cn(
                  'text-xs font-semibold px-3 py-1.5 rounded-full border transition-all',
                  role === r
                    ? 'bg-sycom-500 text-white border-sycom-500'
                    : 'bg-white text-gray-500 border-gray-300 hover:border-sycom-400 hover:text-sycom-500'
                )}>
                {ROLE_CONFIG[r]?.label ?? r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Users grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-sycom-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {users.map((user: any) => {
            const rc = ROLE_CONFIG[user.role]
            const initials = user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
            return (
              <div key={user.id} className={cn(
                'card p-5 transition-all',
                !user.isActive && 'opacity-60'
              )}>
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-11 h-11 rounded-full bg-sycom-500 text-white font-bold text-sm flex items-center justify-center flex-shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{user.name}</p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    {user.department && (
                      <p className="text-[11px] text-gray-400 mt-0.5">{user.department}</p>
                    )}
                  </div>
                  <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md flex-shrink-0"
                    style={{ background: rc?.bg, color: rc?.color }}>
                    {rc?.icon} {rc?.label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4 text-center">
                  <div className="bg-gray-50 rounded-lg py-2">
                    <p className="text-lg font-bold text-sycom-500">{user._count?.ticketsCreated ?? 0}</p>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Tikety</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg py-2">
                    <p className="text-lg font-bold text-sycom-500">{user._count?.ticketsAssigned ?? 0}</p>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Pridelené</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-gray-400">
                    Od {formatDate(user.createdAt)}
                  </span>
                  <button
                    onClick={() => toggleMutation.mutate({ id: user.id, isActive: !user.isActive })}
                    className={cn(
                      'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all',
                      user.isActive
                        ? 'border-red-200 text-red-500 hover:bg-red-50'
                        : 'border-green-200 text-green-600 hover:bg-green-50'
                    )}>
                    {user.isActive
                      ? <><UserX size={12}/> Deaktivovať</>
                      : <><UserCheck size={12}/> Aktivovať</>
                    }
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create user modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="bg-sycom-500 px-6 py-5 flex items-center justify-between">
              <div>
                <p className="text-base font-bold text-white">Nový používateľ</p>
                <p className="text-xs text-white/70">Vyplňte údaje nového používateľa portálu</p>
              </div>
              <button onClick={() => setShowModal(false)}
                className="w-7 h-7 rounded-lg bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors">
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Celé meno *</label>
                  <input {...register('name')} className="input" placeholder="Ján Novák" />
                  {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="label">Email *</label>
                  <input {...register('email')} type="email" className="input" placeholder="jan@firma.sk" />
                  {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
                </div>
              </div>

              <div>
                <label className="label">Heslo *</label>
                <input {...register('password')} type="password" className="input" placeholder="Min. 8 znakov" />
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Rola *</label>
                  <select {...register('role')} className="input">
                    <option value="CLIENT">Klient</option>
                    <option value="AGENT">Technik</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="label">Oddelenie</label>
                  <input {...register('department')} className="input" placeholder="IT, Predaj…" />
                </div>
              </div>

              <div>
                <label className="label">Telefón</label>
                <input {...register('phone')} className="input" placeholder="0900 000 000" />
              </div>

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => { setShowModal(false); reset() }}
                  className="btn btn-ghost flex-1 justify-center">Zrušiť</button>
                <button type="submit" disabled={createMutation.isPending}
                  className="btn btn-primary flex-1 justify-center">
                  {createMutation.isPending ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>}
                  {createMutation.isPending ? 'Vytváram...' : 'Vytvoriť'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PortalLayout>
  )
}
