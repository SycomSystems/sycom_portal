// src/components/layout/PortalLayout.tsx
import { Topbar } from './Topbar'
import { Sidebar } from './Sidebar'
export function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Topbar />
      <div className="flex pt-[62px] h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </>
  )
}
