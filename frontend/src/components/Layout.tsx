import { useState, useEffect } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { ErrorBoundary } from './ErrorBoundary'
import { useAuth } from '@/contexts/AuthContext'
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
  Factory,
  Menu,
  X,
  User
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
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen) {
        setMobileOpen(false)
      }
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const shortcuts: Record<string, string> = {
          '1': '/', '2': '/gas-readings', '3': '/gas-upload',
          '4': '/charges', '5': '/uploads', '6': '/rematch',
          '7': '/analysis', '8': '/monthly-report', '9': '/settings',
        }
        if (shortcuts[e.key]) {
          e.preventDefault()
          navigate(shortcuts[e.key])
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate, mobileOpen])

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow" aria-label="메인 내비게이션">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Factory className="h-8 w-8 text-blue-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">TAEWOONG</span>
              </div>
              <div className="hidden md:ml-6 md:flex md:space-x-8">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
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
            <div className="flex items-center">
              {user && (
                <div className="hidden md:flex items-center mr-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <User className="h-4 w-4 mr-1" />
                    <span>{user.username}</span>
                    {user.role === 'admin' && (
                      <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">관리자</span>
                    )}
                  </div>
                </div>
              )}
              <div className="md:hidden">
                <button
                  onClick={() => setMobileOpen(!mobileOpen)}
                  className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                  aria-label={mobileOpen ? '메뉴 닫기' : '메뉴 열기'}
                  aria-expanded={mobileOpen}
                >
                  {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div 
            className="fixed inset-0 bg-black/20 transition-opacity"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-xl transform transition-transform">
            <div className="flex items-center justify-between px-4 h-16 border-b border-gray-200">
              <div className="flex items-center">
                <Factory className="h-6 w-6 text-blue-600" />
                <span className="ml-2 text-lg font-bold text-gray-900">TAEWOONG</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                aria-label="메뉴 닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {user && (
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                  <div className="ml-3">
                    <div className="text-sm font-medium text-gray-900">{user.username}</div>
                    <div className="text-xs text-gray-500">
                      {user.role === 'admin' ? '관리자' : '사용자'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="px-2 py-4 space-y-1 overflow-y-auto h-[calc(100vh-4rem)]">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center px-3 py-3 rounded-md text-base font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <item.icon className={`mr-3 h-5 w-5 ${isActive ? 'text-blue-500' : 'text-gray-400'}`} />
                    {item.name}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  )
}
