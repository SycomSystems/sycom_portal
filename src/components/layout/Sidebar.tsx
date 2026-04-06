'use client'
// src/components/layout/Sidebar.tsx
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Ticket, Plus, BookOpen, Users, BarChart2, Settings, Wifi, Phone } from 'lucide-react'

// ... (keep your existing navItems and Sidebar logic exactly the same)
// Only change the helpdesk card at the bottom to this:
