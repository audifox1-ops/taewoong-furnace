import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Factory, FileText, FileSpreadsheet, Table, Upload, Zap, Calendar, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export function DashboardPage() {
  const { data: furnaces, error: furnacesError } = useQuery({
    queryKey: ['furnaces'],
    queryFn: () => api.get('/furnaces').then((res) => res.data),
    retry: false,
  })

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/analysis/dashboard').then((res) => res.data),
    retry: false,
  })

  const today = new Date().toISOString().slice(0, 10)
  const { data: usageSummary } = useQuery({
    queryKey: ['usage-summary', today],
    queryFn: () => api.get(`/charges/summary/usage?startDate=${today}&endDate=${today}T23:59:59`).then(r => r.data),
    retry: false,
  })

  const furnaceList = Array.isArray(furnaces) ? furnaces : []

  const statCards = [
    { name: '가열로 수', value: stats?.furnaceCount ?? (furnaceList.length || 19), icon: Factory, href: '/gas-readings', color: 'bg-blue-500' },
    { name: '가스 리딩', value: stats?.gasReadingCount?.toLocaleString() ?? '-', icon: FileText, href: '/gas-readings', color: 'bg-green-500' },
    { name: '차지 기록', value: stats?.chargeCount?.toLocaleString() ?? '-', icon: Table, href: '/charges', color: 'bg-yellow-500' },
    { name: '오늘 차지', value: stats?.todayCharges ?? 0, icon: Calendar, href: '/charges', color: 'bg-orange-500' },
    { name: '전체 사용량', value: stats?.totalUsage ? `${stats.totalUsage.toFixed(1)}` : '-', icon: Zap, href: '/analysis', color: 'bg-red-500' },
    { name: '장입도 PDF', value: stats?.scanCount ?? 0, icon: Upload, href: '/uploads', color: 'bg-purple-500' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">대시보드</h1>

      {furnacesError && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center text-sm text-yellow-800">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
          백엔드 서버에 연결할 수 없습니다. 데이터 표시가 제한될 수 있습니다.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 mb-8">
        {statCards.map((item) => (
          <Link key={item.name} to={item.href}
            className="relative overflow-hidden rounded-lg bg-white px-4 py-5 shadow hover:shadow-md transition-shadow">
            <div className={`absolute rounded-md p-2 ${item.color}`}>
              <item.icon className="h-5 w-5 text-white" />
            </div>
            <p className="ml-12 truncate text-xs font-medium text-gray-500">{item.name}</p>
            <p className="ml-12 mt-1 text-xl font-bold text-gray-900">{item.value}</p>
          </Link>
        ))}
      </div>

      {Array.isArray(usageSummary) && usageSummary.length > 0 && (
        <div className="bg-white shadow rounded-lg p-4 mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">오늘의 호기별 사용량</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usageSummary.map((s: any) => ({ name: s.furnaceName, usage: Math.round(s.totalUsage) }))}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="usage" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">바로가기</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/gas-upload"
              className="flex items-center p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors">
              <FileSpreadsheet className="h-5 w-5 text-teal-600 mr-2" />
              <span className="text-sm font-medium text-gray-700">가스 데이터 업로드</span>
            </Link>
            <Link to="/charges"
              className="flex items-center p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors">
              <Table className="h-5 w-5 text-yellow-600 mr-2" />
              <span className="text-sm font-medium text-gray-700">차지 사용량 입력</span>
            </Link>
            <Link to="/uploads"
              className="flex items-center p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors">
              <Upload className="h-5 w-5 text-purple-600 mr-2" />
              <span className="text-sm font-medium text-gray-700">장입도 PDF 업로드</span>
            </Link>
            <Link to="/analysis"
              className="flex items-center p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors">
              <Zap className="h-5 w-5 text-red-600 mr-2" />
              <span className="text-sm font-medium text-gray-700">분석 대시보드</span>
            </Link>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">가열로 목록</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-48 overflow-auto">
            {furnaceList.length > 0 ? furnaceList.map((furnace: any) => (
              <div key={furnace.id}
                className="border border-gray-200 rounded-lg px-3 py-2 text-center hover:border-blue-500 transition-colors cursor-pointer">
                <p className="text-sm font-medium text-gray-900">{furnace.name}</p>
                <p className="text-xs text-gray-500">{furnace.no}호기</p>
              </div>
            )) : (
              [1,2,3,4,5,6,8,9,10,11,12,13,14,15,16,17,18,19,20].map(n => (
                <div key={n} className="border border-gray-200 rounded-lg px-3 py-2 text-center">
                  <p className="text-sm font-medium text-gray-900">가열{n}호</p>
                  <p className="text-xs text-gray-500">{n}호기</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-2">가스 사용량 계산 규칙</h2>
        <div className="text-sm text-gray-600 space-y-1">
          <p><strong>사용량</strong> = 사용후(가스누적지침) − 사용전(가스누적지침)</p>
          <p><strong>기준값</strong>: <code>가스누적지침</code> (적산계 누적값). <code>가스</code> 컬럼이 아님.</p>
          <p><strong>교대시간</strong>: 주간 08:00~19:30 / 야간 20:00~익일 07:00</p>
          <p><strong>시작점 우선순위</strong>: (1) 직전 작업 종료 시각 (2) 근무 시작 경계</p>
        </div>
      </div>
    </div>
  )
}
