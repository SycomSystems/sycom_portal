// src/components/layout/PortalLayout.tsx
import { Topbar } from './Topbar'
import { Sidebar } from './Sidebar'

export function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Topbar />
      <div className="flex pt-[62px] min-h-screen">
        <Sidebar />
        <main className="flex-1 flex flex-col min-h-[calc(100vh-62px)] overflow-auto">
          {children}
        </main>
      </div>
    </>
  )
}
