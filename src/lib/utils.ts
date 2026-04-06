// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, format } from 'date-fns'
import { sk } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string) {
  return format(new Date(date), 'd. MMM yyyy', { locale: sk })
}

export function formatDateTime(date: Date | string) {
  return format(new Date(date), 'd. MMM yyyy HH:mm', { locale: sk })
}

export function timeAgo(date: Date | string) {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: sk })
}

// SLA deadline based on priority
export function getSlaDeadline(priority: string): Date {
  const now = new Date()
  const hours: Record<string, number> = {
    CRITICAL: 1,
    HIGH:     4,
    MEDIUM:   24,
    LOW:      72,
  }
  now.setHours(now.getHours() + (hours[priority] ?? 24))
  return now
}

export function isSlaBreached(deadline: Date | null): boolean {
  if (!deadline) return false
  return new Date() > new Date(deadline)
}

export function isSlaWarning(deadline: Date | null): boolean {
  if (!deadline) return false
  const now = new Date()
  const dl  = new Date(deadline)
  const diffMs = dl.getTime() - now.getTime()
  return diffMs > 0 && diffMs < 60 * 60 * 1000 // within 1 hour
}

// Labels for display
export const priorityLabels: Record<string, string> = {
  LOW: 'Nízka', MEDIUM: 'Stredná', HIGH: 'Vysoká', CRITICAL: 'Kritická',
}

export const statusLabels: Record<string, string> = {
  OPEN: 'Otvorený', IN_PROGRESS: 'V riešení', WAITING: 'Čaká',
  RESOLVED: 'Vyriešený', CLOSED: 'Uzavretý',
}

export const categoryLabels: Record<string, string> = {
  HARDWARE: 'Hardvér', SOFTWARE: 'Softvér', NETWORK: 'Sieť/VPN',
  EMAIL: 'Email', SECURITY: 'Bezpečnosť', CLOUD: 'Cloud',
  ONBOARDING: 'Onboarding', OTHER: 'Iné',
}
