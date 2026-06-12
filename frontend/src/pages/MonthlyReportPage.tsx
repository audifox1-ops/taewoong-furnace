import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { format } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Calendar, Download } from 'lucide-react'

export function MonthlyReportPage() {
  const [yearMonth, setYearMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [furnaceId, setFurnaceId] = useState<number | ''>('')

  const year = parseInt(yearMonth.split('-')[0])
  const month = parseInt(yearMonth.split('-')[1])
  const startDate = format(new Date(year, month - 1, 1), 'yyyy-MM-dd')
  const endDate = format(new Date(year, month, 0), 'yyyy-MM-dd')

  const { data: furnaces } = useQuery({
    queryKey: ['furnaces'],
    queryFn: () => api.get('/furnaces').then(r => r.data),
  })

  const { data: summary } = useQuery({
    queryKey: ['monthly-summary', yearMonth, furnaceId],
    queryFn: () => {
      const params = new URLSearchParams({ startDate, endDate })
      if (furnaceId) params.append('furnaceId', String(furnaceId))
      return api.get(`/charges?${params.toString()}`).then(r => r.data)
    },
  })

  const { data: usageByFurnace } = useQuery({
    queryKey: ['monthly-usage-by-furnace', yearMonth],
    queryFn: () => api.get(`/analysis/usage-by-furnace?startDate=${startDate}&endDate=${endDate}`).then(r => r.data),
  })

  const charges = summary || []
  const totalUsage = charges.reduce((sum: number, c: any) => sum + (c.usage || 0), 0)
  const dayUsage = charges.filter((c: any) => c.shift === 'day').reduce((s: number, c: any) => s + (c.usage || 0), 0)
  const nightUsage = charges.filter((c: any) => c.shift === 'night').reduce((s: number, c: any) => s + (c.usage || 0), 0)
  const avgUsage = charges.length > 0 ? totalUsage / charges.length : 0

  const furnaceUsageData = (usageByFurnace || []).map((f: any) => ({
    name: f.name,
    usage: Math.round(f.usage * 100) / 100,
  }))

  const shiftPieData = [
    { name: '주간', value: Math.round(dayUsage * 100) / 100 },
    { name: '야간', value: Math.round(nightUsage * 100) / 100 },
  ]
  const COLORS = ['#F59E0B', '#6366F1']

  const exportReport = () => {
    const headers = ['차지번호', '가열로', '사용전', '사용후', '사용량', '날짜', '교대', '비고']
    const data = charges.map((c: any) => [
      c.chargeNo, c.furnace?.name, c.gasBefore, c.gasAfter, c.usage?.toFixed(2),
      format(new Date(c.workDate), 'yyyy-MM-dd'), c.shift === 'day' ? '주간' : '야간', c.note,
    ])
    const csv = [headers, ...data].map(r => r.join('\t')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `monthly-report-${yearMonth}.csv`
    a.click()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">월별 리포트</h1>
        <button onClick={exportReport}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
          <Download className="h-4 w-4 mr-2" />
          리포트 내보내기
        </button>
      </div>

      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">연월</label>
            <input type="month" value={yearMonth} onChange={(e) => setYearMonth(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">가열로</label>
            <select value={furnaceId} onChange={(e) => setFurnaceId(e.target.value ? Number(e.target.value) : '')}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm">
              <option value="">전체</option>
              {furnaces?.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white shadow rounded-lg p-4">
          <p className="text-xs text-gray-500">총 차지 수</p>
          <p className="text-2xl font-bold text-gray-900">{charges.length}</p>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <p className="text-xs text-gray-500">총 사용량</p>
          <p className="text-2xl font-bold text-blue-600">{totalUsage.toFixed(1)}</p>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <p className="text-xs text-gray-500">평균 사용량/차지</p>
          <p className="text-2xl font-bold text-green-600">{avgUsage.toFixed(1)}</p>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <p className="text-xs text-gray-500">주간/야간 비율</p>
          <p className="text-lg font-bold text-gray-900">
            {totalUsage > 0 ? `${Math.round(dayUsage / totalUsage * 100)}% / ${Math.round(nightUsage / totalUsage * 100)}%` : '-'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white shadow rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">호기별 사용량</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={furnaceUsageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="usage" fill="#3B82F6" name="사용량" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">주간/야간 비율</h3>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={shiftPieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {shiftPieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charge Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 flex items-center">
            <Calendar className="h-4 w-4 mr-1" />
            {yearMonth} 차지 상세 ({charges.length}건)
          </h3>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">차지번호</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">가열로</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">사용량</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">날짜</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">교대</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {charges.map((c: any) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-blue-600 font-medium">{c.chargeNo}</td>
                  <td className="px-3 py-2">{c.furnace?.name}</td>
                  <td className="px-3 py-2 text-right font-medium">{c.usage?.toFixed(2) ?? '-'}</td>
                  <td className="px-3 py-2 text-gray-600">{format(new Date(c.workDate), 'MM-dd')}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${c.shift === 'day' ? 'bg-yellow-100 text-yellow-800' : 'bg-indigo-100 text-indigo-800'}`}>
                      {c.shift === 'day' ? '주간' : '야간'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
