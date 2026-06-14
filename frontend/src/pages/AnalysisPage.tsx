import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { format, subDays } from 'date-fns'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, ResponsiveContainer } from 'recharts'
import { PdfViewer } from '@/components/PdfViewer'
import { ChartSkeleton } from '@/components/Skeleton'
import { BarChart3, Table, FileText } from 'lucide-react'

type Tab = 'charts' | 'compare'

export function AnalysisPage() {
  const [tab, setTab] = useState<Tab>('charts')
  const [furnaceId, setFurnaceId] = useState(1)
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedChargeId, setSelectedChargeId] = useState<number | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  const { data: furnaces } = useQuery({
    queryKey: ['furnaces'],
    queryFn: () => api.get('/furnaces').then((res) => res.data),
  })

  const { data: usageTrend } = useQuery({
    queryKey: ['usage-trend', furnaceId, startDate, endDate],
    queryFn: () => api.get(`/analysis/usage-trend?furnaceId=${furnaceId}&startDate=${startDate}&endDate=${endDate}`).then((res) => res.data),
    enabled: !!furnaceId && tab === 'charts',
  })

  const { data: temperatureTrend } = useQuery({
    queryKey: ['temperature-trend', furnaceId, startDate, endDate],
    queryFn: () => api.get(`/analysis/temperature-trend?furnaceId=${furnaceId}&startDate=${startDate}&endDate=${endDate}`).then((res) => res.data),
    enabled: !!furnaceId && tab === 'charts',
  })

  const { data: usageByFurnace } = useQuery({
    queryKey: ['usage-by-furnace', startDate, endDate],
    queryFn: () => api.get(`/analysis/usage-by-furnace?startDate=${startDate}&endDate=${endDate}`).then((res) => res.data),
    enabled: tab === 'charts',
  })

  const { data: usageByShift } = useQuery({
    queryKey: ['usage-by-shift', startDate, endDate],
    queryFn: () => api.get(`/analysis/usage-by-shift?startDate=${startDate}&endDate=${endDate}`).then((res) => res.data),
    enabled: tab === 'charts',
  })

  const { data: charges } = useQuery({
    queryKey: ['charges-compare', furnaceId, startDate, endDate],
    queryFn: () => {
      const params = new URLSearchParams()
      params.append('furnaceId', String(furnaceId))
      params.append('startDate', startDate)
      params.append('endDate', endDate + 'T23:59:59')
      return api.get(`/charges?${params.toString()}`).then((res) => res.data)
    },
    enabled: tab === 'compare',
  })

  const { data: selectedCharge } = useQuery({
    queryKey: ['charge-detail', selectedChargeId],
    queryFn: () => api.get(`/charges/${selectedChargeId}`).then((res) => res.data),
    enabled: !!selectedChargeId,
  })

  const handleSelectCharge = async (charge: any) => {
    setSelectedChargeId(charge.id)
    if (charge.chargeRecord?.chargeScanId) {
      try {
        const res = await api.get(`/uploads/pdf/${charge.chargeRecord.chargeScanId}/url`)
        setPdfUrl(res.data.url)
      } catch { setPdfUrl(null) }
    } else {
      setPdfUrl(null)
    }
  }

  const shiftLabel = (s: string) => s === 'day' ? '주간' : '야간'

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">분석</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('charts')}
          className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'charts' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <BarChart3 className="h-4 w-4 mr-1" />
          차트 분석
        </button>
        <button
          onClick={() => setTab('compare')}
          className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'compare' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="h-4 w-4 mr-1" />
          차지 + PDF 비교
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">가열로</label>
            <select
              value={furnaceId}
              onChange={(e) => setFurnaceId(Number(e.target.value))}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              {furnaces?.map((f: any) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
          </div>
        </div>
      </div>

      {tab === 'charts' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white shadow rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">가스 사용량 추이</h3>
              <div className="h-64">
                {usageTrend ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={usageTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="usage" stroke="#3B82F6" name="사용량" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <ChartSkeleton />}
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">온도 추이</h3>
              <div className="h-64">
                {temperatureTrend ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={temperatureTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="avgTemp" stroke="#EF4444" name="평균온도" />
                      <Line type="monotone" dataKey="minTemp" stroke="#3B82F6" name="최저온도" />
                      <Line type="monotone" dataKey="maxTemp" stroke="#F59E0B" name="최고온도" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <ChartSkeleton />}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white shadow rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">호기별 사용량</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={usageByFurnace || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="usage" fill="#3B82F6" name="사용량" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">주간/야간 사용량</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: '주간', usage: usageByShift?.day?.usage || 0 },
                      { name: '야간', usage: usageByShift?.night?.usage || 0 },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="usage" fill="#10B981" name="사용량" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'compare' && (
        <div className="flex flex-col md:flex-row gap-6" style={{ minHeight: '70vh' }}>
          {/* Left: charge list + detail cards */}
          <div className="w-full md:w-1/2 flex flex-col gap-4">
            {/* Summary cards */}
            {selectedCharge && (
              <div className="bg-white shadow rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-500 mb-3">
                  {selectedCharge.chargeNo} — {selectedCharge.furnace?.name} — {shiftLabel(selectedCharge.shift)}
                </h3>
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">사용전</p>
                    <p className="text-lg font-bold text-blue-700">{selectedCharge.gasBefore?.toFixed(2) ?? '-'}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">사용후</p>
                    <p className="text-lg font-bold text-green-700">{selectedCharge.gasAfter?.toFixed(2) ?? '-'}</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">사용량</p>
                    <p className="text-lg font-bold text-orange-700">{selectedCharge.usage?.toFixed(2) ?? '-'}</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">원단위</p>
                    <p className="text-lg font-bold text-purple-700">
                      {selectedCharge.gasUsage?.unitRate?.toFixed(4) ?? '-'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Charge list */}
            <div className="bg-white shadow rounded-lg flex-1 overflow-auto">
              <div className="px-4 py-3 border-b border-gray-200 sticky top-0 bg-white">
                <h3 className="text-sm font-medium text-gray-700">
                  <Table className="inline h-4 w-4 mr-1" />
                  차지 목록 ({charges?.length || 0}건)
                </h3>
              </div>
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">차지번호</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">날짜</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">교대</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">사용량</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {charges?.map((c: any) => (
                    <tr
                      key={c.id}
                      onClick={() => handleSelectCharge(c)}
                      className={`cursor-pointer hover:bg-blue-50 ${selectedChargeId === c.id ? 'bg-blue-100' : ''}`}
                    >
                      <td className="px-3 py-2 font-medium">{c.chargeNo}</td>
                      <td className="px-3 py-2 text-gray-600">{format(new Date(c.workDate), 'MM-dd')}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          c.shift === 'day' ? 'bg-yellow-100 text-yellow-800' : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {shiftLabel(c.shift)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-gray-900">
                        {c.usage?.toFixed(2) ?? '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: PDF viewer or placeholder */}
          <div className="w-full md:w-1/2">
            {pdfUrl ? (
              <div className="h-full rounded-lg overflow-hidden shadow">
                <PdfViewer url={pdfUrl} />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center bg-white rounded-lg shadow">
                <div className="text-center text-gray-400">
                  <FileText className="mx-auto h-12 w-12 mb-2" />
                  <p className="text-sm">차지를 선택하면 연결된 장입도 PDF가 표시됩니다</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
