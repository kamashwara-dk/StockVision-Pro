import { DashboardNavbar } from "@/components/dashboard/DashboardNavbar"
import { getUser } from "@/utils/supabase/getUser"
import { PortfolioProvider } from "@/components/providers/PortfolioProvider"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getUser()
  const name = user?.user_metadata?.display_name || user?.email || 'User'

  return (
    <PortfolioProvider>
      <div className="flex flex-col min-h-screen bg-[#0A0F1E]">
        <DashboardNavbar userName={name} />
        {/* pt-28 = 112px clears the fixed navbar (top-6=24px + nav height ~60px + buffer) */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pt-28 pb-8">
          {children}
        </main>
      </div>
    </PortfolioProvider>
  )
}
