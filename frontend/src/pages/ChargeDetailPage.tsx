import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { format } from 'date-fns'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { PdfViewer } from '@/components/PdfViewer'
import { ArrowLeft, Thermometer, Zap, FileText, Calendar, Clock } from 'lucide-react'

export function ChargeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  const { data: charge, isLoading } = useQuery({
    queryKey: ['charge-detail', id],
    queryFn: () => api.get(`/charges/${id}`).then(r => r.data),
    enabled: !!id,
  })

  const { data: gasData } = useQuery({
    queryKey: ['gas-for-charge', charge],
    queryFn: () => {
      if (!charge) return null
      const start = new Date(charge.workDate)
      if (charge.shift === 'night') start.setDate(start.getDate() - 1)
      start.setHours(charge.shift === 'day' ? 8 : 20, 0, 0, 0)

      const end = new Date(charge.workDate)
      if (charge.shift === 'night') end.setDate(end.getDate() + 1)
      end.setHours(charge.shift === 'day' ? 19 : 7, 30, 0, 0)

      return api.get(`/gas-readings/furnace/${charge.furnaceId}?startDate=${start.toISOString()}&endDate=${end.toISOString()}`)
        .then(r => r.data)
    },
    enabled: !!charge,
  })

  useEffect(() => {
    if (charge?.chargeRecord?.chargeScanId) {
      api.get(`/uploads/pdf/${charge.chargeRecord.chargeScanId}/url`)
        .then(r => setPdfUrl(r.data.url))
        .catch(() => setPdfUrl(null))
    }
  }, [charge])

  if (isLoading) return <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full" /></div>
  if (!charge) return <div className="text-center py-12 text-gray-500">차지를 찾을 수 없습니다</div>

  const chartData = (gasData || []).map((r: any) => ({
    time: format(new Date(r.ts), 'HH:mm'),
    gasCumulative: r.gasCumulative,
    temp: r.temp,
  }))

  const shiftLabel = charge.shift === 'day' ? '주간' : '야간'
  const shiftColor = charge.shift === 'day' ? 'bg-yellow-100 text-yellow-800' : 'bg-indigo-100 text-indigo-800'

  return (
    <div>
      <button onClick={() => navigate(-1)} className="flex items-center text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" />
        뒤로
      </button>

      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{charge.chargeNo}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {charge.furnace?.name} · {format(new Date(charge.workDate), 'yyyy-MM-dd')} ·
            <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${shiftColor}`}>{shiftLabel}</span>
          </p>
        </div>
        {charge.chargeRecord && (
          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
            장입도 연결됨
          </span>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center text-gray-500 mb-1">
            <Zap className="h-4 w-4 mr-1" />
            <span className="text-xs">사용전</span>
          </div>
          <p className="text-xl font-bold text-blue-700">{charge.gasBefore?.toFixed(2) ?? '-'}</p>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center text-gray-500 mb-1">
            <Zap className="h-4 w-4 mr-1" />
            <span className="text-xs">사용후</span>
          </div>
          <p className="text-xl font-bold text-green-700">{charge.gasAfter?.toFixed(2) ?? '-'}</p>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center text-gray-500 mb-1">
            <Zap className="h-4 w-4 mr-1" />
            <span className="text-xs">사용량</span>
          </div>
          <p className={`text-xl font-bold ${charge.usage != null && charge.usage < 0 ? 'text-red-600' : 'text-orange-600'}`}>
            {charge.usage?.toFixed(2) ?? '-'}
          </p>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center text-gray-500 mb-1">
            <Calendar className="h-4 w-4 mr-1" />
            <span className="text-xs">원단위</span>
          </div>
          <p className="text-xl font-bold text-purple-700">{charge.gasUsage?.unitRate?.toFixed(4) ?? '-'}</p>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center text-gray-500 mb-1">
            <Clock className="h-4 w-4 mr-1" />
            <span className="text-xs">수기종료</span>
          </div>
          <p className="text-sm font-bold text-gray-900">
            {charge.chargeRecord?.workEnd ? format(new Date(charge.chargeRecord.workEnd), 'HH:mm') : '-'}
          </p>
        </div>
      </div>

      <div className="flex gap-6" style={{ minHeight: '60vh' }}>
        {/* Left: Charts */}
        <div className="w-1/2 flex flex-col gap-4">
          <div className="bg-white shadow rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
              <Zap className="h-4 w-4 mr-1 text-blue-500" />
              가스 누적지침 시계열
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="gasCumulative" stroke="#3B82F6" name="누적지침" dot={false} />
                  {charge.gasBefore && <ReferenceLine y={charge.gasBefore} stroke="#22C55E" strokeDasharray="5 5" label="사용전" />}
                  {charge.gasAfter && <ReferenceLine y={charge.gasAfter} stroke="#EF4444" strokeDasharray="5 5" label="사용후" />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
              <Thermometer className="h-4 w-4 mr-1 text-red-500" />
              온도 시계열
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="temp" stroke="#EF4444" name="온도" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {charge.note && (
            <div className="bg-white shadow rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">비고</h3>
              <p className="text-sm text-gray-600">{charge.note}</p>
            </div>
          )}
        </div>

        {/* Right: PDF */}
        <div className="w-1/2">
          {pdfUrl ? (
            <div className="h-full rounded-lg overflow-hidden shadow">
              <PdfViewer url={pdfUrl} />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center bg-white rounded-lg shadow">
              <div className="text-center text-gray-400">
                <FileText className="mx-auto h-12 w-12 mb-2" />
                <p className="text-sm">연결된 장입도 PDF가 없습니다</p>
                <p className="text-xs mt-1">차지 사용량 페이지에서 장입도를 연결할 수 있습니다</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
