import { Outlet, Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  FileText, 
  FileSpreadsheet,
  Table, 
  Upload, 
  BarChart3, 
  Calendar,
  Settings,
  Link2,
  Factory
} from 'lucide-react'

const navigation = [
  { name: '대시보드', href: '/', icon: LayoutDashboard },
  { name: '가스 시계열', href: '/gas-readings', icon: FileText },
  { name: '가스 업로드', href: '/gas-upload', icon: FileSpreadsheet },
  { name: '차지 사용량', href: '/charges', icon: Table },
  { name: '장입도 업로드', href: '/uploads', icon: Upload },
  { name: '매칭 관리', href: '/rematch', icon: Link2 },
  { name: '분석', href: '/analysis', icon: BarChart3 },
  { name: '월별 리포트', href: '/monthly-report', icon: Calendar },
  { name: '설정', href: '/settings', icon: Settings },
]

export function Layout() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Factory className="h-8 w-8 text-blue-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">TAEWOONG</span>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                        isActive
                          ? 'border-blue-500 text-gray-900'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      }`}
                    >
                      <item.icon className="mr-1 h-4 w-4" />
                      {item.name}
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}
