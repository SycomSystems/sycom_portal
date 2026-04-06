// src/components/layout/PortalLayout.tsx
import { Topbar } from './Topbar'
import { Sidebar } from './Sidebar'

export function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Topbar />
      <div className="flex pt-[62px] min-h-screen">
        <Sidebar />
        <main className="ml-[220px] flex-1 p-7 min-h-[calc(100vh-62px)]">
          {children}
        </main>
      </div>
    </>
  )
}
