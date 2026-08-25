import { Outlet } from 'react-router-dom'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import BackNavigation from '@/components/BackNavigation'
import { useState } from 'react'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-white overflow-hidden text-[#111111] antialiased">
      {/* Global Enterprise Sidebar */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white">
        {/* Enterprise Top Navigation */}
        <Topbar onMenuClick={() => setSidebarOpen(true)} />

        {/* Page Content Container */}
        <main className="flex-1 overflow-y-auto px-6 py-6 lg:px-10 lg:py-8 bg-white">
          <div className="max-w-7xl mx-auto w-full">
            {/* Global Back Navigation */}
            <BackNavigation />

            {/* Routed View */}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
