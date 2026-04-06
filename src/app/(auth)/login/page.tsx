'use client'
// src/app/(auth)/login/page.tsx
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

const schema = z.object({
  email:    z.string().email('Neplatný email'),
  password: z.string().min(1, 'Zadajte heslo'),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    const result = await signIn('credentials', {
      email:    data.email,
      password: data.password,
      redirect: false,
    })
    setLoading(false)

    if (result?.error) {
      toast.error('Nesprávny email alebo heslo')
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sycom-50 via-white to-blue-50 flex items-center justify-center p-4">

      {/* Background grid */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(26,111,186,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(26,111,186,0.04)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-sycom-500 rounded-xl flex items-center justify-center shadow-lg shadow-sycom-500/30">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="3" width="20" height="14" rx="2" stroke="white" strokeWidth="1.8"/>
                <path d="M8 21h8M12 17v4" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                <path d="M7 10l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="text-left">
              <div className="text-2xl font-bold text-sycom-500 leading-none">sycom</div>
              <div className="text-[10px] font-bold tracking-widest uppercase text-gray-400">IT Podpora</div>
            </div>
          </div>
          <h1 className="text-xl font-bold text-gray-800">Prihlásenie do portálu</h1>
          <p className="text-sm text-gray-500 mt-1">Zadajte svoje prihlasovacie údaje</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-sycom-500/10 border border-gray-100 p-8">
          <div className="h-1 bg-gradient-to-r from-sycom-500 to-sycom-300 rounded-full mb-8 -mx-8 -mt-8 rounded-t-2xl" />

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="label">Email</label>
              <input
                {...register('email')}
                type="email"
                className="input"
                placeholder="vas@firma.sk"
                autoComplete="email"
              />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Heslo</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPw ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full justify-center py-3 text-base mt-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? 'Prihlasujem...' : 'Prihlásiť sa'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            Problémy s prihlásením?{' '}
            <a href="mailto:helpdesk@sycom.sk" className="text-sycom-500 hover:underline font-semibold">
              Kontaktujte helpdesk
            </a>
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} Sycom s.r.o. · Hviezdoslavova 1, Senec
        </p>
      </div>
    </div>
  )
}
