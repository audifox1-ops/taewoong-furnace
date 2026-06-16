import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useToast } from '@/components/Toast'
import { Settings, Clock, Save, RotateCcw, RefreshCw, FileSpreadsheet, AlertTriangle } from 'lucide-react'

interface ShiftConfig {
  dayStart: string
  dayEnd: string
  nightStart: string
  nightEnd: string
}

const DEFAULT_CONFIG: ShiftConfig = {
  dayStart: '08:00',
  dayEnd: '19:30',
  nightStart: '20:00',
  nightEnd: '07:00',
}

export function SettingsPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [config, setConfig] = useState<ShiftConfig>(DEFAULT_CONFIG)

  const { data: savedConfig, isLoading: isLoadingConfig } = useQuery({
    queryKey: ['shift-config'],
    queryFn: () => api.get('/settings/shift').then((res) => res.data as ShiftConfig),
    retry: false,
  })

  useEffect(() => {
    if (savedConfig) {
      setConfig(savedConfig)
    }
  }, [savedConfig])

  const saveMutation = useMutation({
    mutationFn: (newConfig: ShiftConfig) => api.put('/settings/shift', newConfig).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-config'] })
      toast('success', '설정이 저장되었습니다')
    },
    onError: () => toast('error', '설정 저장 중 오류가 발생했습니다'),
  })

  const handleSave = () => {
    saveMutation.mutate(config)
  }

  const handleReset = () => {
    setConfig(DEFAULT_CONFIG)
    saveMutation.mutate(DEFAULT_CONFIG)
    toast('info', '기본값으로 초기화되었습니다')
  }

  const { data: furnaceFixCandidates, isLoading: isLoadingFixCandidates } = useQuery({
    queryKey: ['gas-reading-furnace-fix-candidates'],
    queryFn: () => api.get('/gas-readings/furnace-fix-candidates?currentFurnaceNo=1').then((res) => Array.isArray(res.data) ? res.data : []),
  })

  const fixOneMutation = useMutation({
    mutationFn: (batchId: number) => api.post('/gas-readings/fix-furnace-batch', { batchId, currentFurnaceNo: 1 }).then((res) => res.data),
    onSuccess: (result) => {
      if (result.updated) {
        toast('success', `${result.fileName}를 ${result.toFurnaceNo}호기로 수정했습니다`)
      } else {
        toast('info', result.reason || '수정할 항목이 없습니다')
      }
      queryClient.invalidateQueries({ queryKey: ['gas-reading-furnace-fix-candidates'] })
      queryClient.invalidateQueries({ queryKey: ['upload-history'] })
      queryClient.invalidateQueries({ queryKey: ['gas-readings'] })
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message
      toast('error', typeof message === 'string' ? message : '호기 수정 중 오류가 발생했습니다')
    },
  })

  const fixAllMutation = useMutation({
    mutationFn: () => api.post('/gas-readings/fix-furnace-batches', {
      batchIds: (furnaceFixCandidates || []).map((item: any) => item.batchId),
      currentFurnaceNo: 1,
    }).then((res) => res.data),
    onSuccess: (results) => {
      const updated = results.filter((item: any) => item.updated).length
      const skipped = results.length - updated
      toast('success', `일괄 수정 완료: ${updated}건 적용, ${skipped}건 건너뜀`)
      queryClient.invalidateQueries({ queryKey: ['gas-reading-furnace-fix-candidates'] })
      queryClient.invalidateQueries({ queryKey: ['upload-history'] })
      queryClient.invalidateQueries({ queryKey: ['gas-readings'] })
    },
    onError: () => {
      toast('error', '일괄 수정 중 오류가 발생했습니다')
    },
  })

  const parseTime = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return { hours: h, minutes: m }
  }

  const formatDuration = (start: string, end: string, crossesMidnight: boolean) => {
    const s = parseTime(start)
    const e = parseTime(end)
    let diffMinutes = (e.hours * 60 + e.minutes) - (s.hours * 60 + s.minutes)
    if (crossesMidnight) diffMinutes += 24 * 60
    const hours = Math.floor(diffMinutes / 60)
    const minutes = diffMinutes % 60
    return `${hours}시간 ${minutes}분`
  }

  if (isLoadingConfig) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">설정</h1>
        <div className="bg-white shadow rounded-lg p-6 text-center text-gray-500">
          설정을 불러오는 중...
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">설정</h1>

      <div className="max-w-2xl space-y-6">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Clock className="h-5 w-5 text-blue-500 mr-2" />
            <h2 className="text-lg font-medium text-gray-900">교대 시간 설정</h2>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                <span className="w-3 h-3 rounded-full bg-yellow-400 mr-2" />
                주간 (Day)
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500">시작 시간</label>
                  <input type="time" value={config.dayStart}
                    onChange={(e) => setConfig({ ...config, dayStart: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500">종료 시간</label>
                  <input type="time" value={config.dayEnd}
                    onChange={(e) => setConfig({ ...config, dayEnd: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
                </div>
                <p className="text-xs text-gray-400">
                  근무시간: {formatDuration(config.dayStart, config.dayEnd, false)}
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                <span className="w-3 h-3 rounded-full bg-indigo-500 mr-2" />
                야간 (Night)
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500">시작 시간</label>
                  <input type="time" value={config.nightStart}
                    onChange={(e) => setConfig({ ...config, nightStart: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500">종료 시간</label>
                  <input type="time" value={config.nightEnd}
                    onChange={(e) => setConfig({ ...config, nightEnd: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
                </div>
                <p className="text-xs text-gray-400">
                  근무시간: {formatDuration(config.nightStart, config.nightEnd, true)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
            <p>비근무 구간: {config.dayEnd} ~ {config.nightStart}, {config.nightEnd} ~ {config.dayStart}</p>
            <p className="mt-1">* 설정은 서버 데이터베이스에 저장됩니다.</p>
          </div>

          <div className="mt-4 flex gap-2">
            <button onClick={handleSave} disabled={saveMutation.isPending}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
              <Save className="h-4 w-4 mr-1" />
              {saveMutation.isPending ? '저장 중...' : '저장'}
            </button>
            <button onClick={handleReset} disabled={saveMutation.isPending}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
              <RotateCcw className="h-4 w-4 mr-1" />
              기본값으로 초기화
            </button>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Settings className="h-5 w-5 text-gray-500 mr-2" />
            <h2 className="text-lg font-medium text-gray-900">시스템 정보</h2>
          </div>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">가열로 수</dt>
              <dd className="font-medium text-gray-900">19개 (7호기 제외)</dd>
            </div>
            <div>
              <dt className="text-gray-500">교대 시간</dt>
              <dd className="font-medium text-gray-900">
                주간 {config.dayStart}~{config.dayEnd} / 야간 {config.nightStart}~{config.nightEnd}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">데이터베이스</dt>
              <dd className="font-medium text-gray-900">PostgreSQL</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <FileSpreadsheet className="h-5 w-5 text-blue-500 mr-2" />
              <h2 className="text-lg font-medium text-gray-900">가열로 일괄 수정</h2>
            </div>
            <button
              onClick={() => fixAllMutation.mutate()}
              disabled={fixAllMutation.isPending || !furnaceFixCandidates?.length}
              className="inline-flex items-center px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${fixAllMutation.isPending ? 'animate-spin' : ''}`} />
              전체 적용
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <AlertTriangle className="h-4 w-4" />
            <span>파일명에서 추출된 호기와 현재 저장된 호기가 다른 배치만 표시합니다. 먼저 미리보기로 확인한 뒤 적용하세요.</span>
          </div>

          {isLoadingFixCandidates ? (
            <div className="text-sm text-gray-500">후보를 불러오는 중...</div>
          ) : !furnaceFixCandidates?.length ? (
            <div className="text-sm text-gray-500">수정이 필요한 가열로 배치가 없습니다.</div>
          ) : (
            <div className="space-y-3">
              {furnaceFixCandidates.map((item: any) => (
                <div key={item.batchId} className="border rounded-lg p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.fileName}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      현재 {item.currentFurnaceName || `${item.currentFurnaceNo}호기`} {'->'} 대상 {item.targetFurnaceName || '미확인'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      행 수 {item.rowCount?.toLocaleString()}건
                      {item.minTimestamp && ` · ${new Date(item.minTimestamp).toLocaleString()}`}
                    </p>
                  </div>
                  <button
                    onClick={() => fixOneMutation.mutate(item.batchId)}
                    disabled={fixOneMutation.isPending}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    개별 수정
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
