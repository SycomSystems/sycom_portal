'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function NewItemPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/admin/sklad?new=1') }, [router])
  return null
}
