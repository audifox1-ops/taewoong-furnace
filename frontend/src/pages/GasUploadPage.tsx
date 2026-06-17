import { useState, useRef, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { QUERY_KEYS } from '@/lib/queryKeys'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Clock, Loader2, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'

interface QueueItem {
  file: File
  status: 'pending' | 'uploading' | 'completed' | 'error'
  furnaceNo?: number | null
  periodStart?: string
  periodEnd?: string
  result?: any
  error?: string
}

function parseFileName(name: string) {
  const normalizeDigits = (value: string) =>
    value.replace(/[０-９]/g, (digit) => String(digit.charCodeAt(0) - 0xFF10))

  const base = name.replace(/\.(xlsx|xls|csv)$/i, '')
  const normalizedBase = normalizeDigits(base)
  let furnaceNo: number | null = null
  let periodStart: string | null = null
  let periodEnd: string | null = null

  const furnaceMatch = normalizedBase.match(/(?:가열\s*로?)?\s*(\d+)\s*호(?:기)?/i)
  if (furnaceMatch) furnaceNo = parseInt(furnaceMatch[1])

  const dateMatch = normalizedBase.match(/\((\d{4}-\d{2}-\d{2})\s*[~\-]\s*(\d{4}-\d{2}-\d{2})\)/)
  if (dateMatch) {
    periodStart = dateMatch[1]
    periodEnd = dateMatch[2]
  }

  return { furnaceNo, periodStart, periodEnd }
}

const STATUS_CONFIG = {
  pending: { icon: Clock, color: 'text-gray-400', bg: 'bg-gray-50', label: '대기' },
  uploading: { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-50', label: '처리 중' },
  completed: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50', label: '완료' },
  error: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50', label: '실패' },
}

export function GasUploadPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [duplicateMode, setDuplicateMode] = useState<'skip' | 'upsert'>('skip')
  const [isProcessing, setIsProcessing] = useState(false)
  const [showUpsertConfirm, setShowUpsertConfirm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)

  const { data: uploadHistory } = useQuery({
    queryKey: QUERY_KEYS.uploadHistory,
    queryFn: () => api.get('/gas-readings/upload-history').then(r => Array.isArray(r.data) ? r.data : []),
  })

  const { data: furnaces } = useQuery({
    queryKey: ['furnaces'],
    queryFn: () => api.get('/furnaces').then(r => Array.isArray(r.data) ? r.data : []),
  })

  const addOptimisticHistoryItem = (item: QueueItem, furnace: any) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const optimisticHistoryItem = {
      id: tempId,
      tempId,
      fileName: item.file.name,
      furnaceId: furnace.id,
      furnace,
      periodStart: item.periodStart ? new Date(item.periodStart).toISOString() : null,
      periodEnd: item.periodEnd ? new Date(item.periodEnd).toISOString() : null,
      rowCount: null,
      successCount: null,
      errorCount: null,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    }

    queryClient.setQueryData(QUERY_KEYS.uploadHistory, (prev: any) => {
      const current = Array.isArray(prev) ? prev : []
      return [optimisticHistoryItem, ...current.filter((historyItem: any) => historyItem.id !== tempId)]
    })

    return tempId
  }

  const deleteUploadHistoryMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/gas-readings/upload-history/${id}`),
    onMutate: async (batchId) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.uploadHistory })
      const previousHistory = queryClient.getQueryData(QUERY_KEYS.uploadHistory)
      queryClient.setQueryData(QUERY_KEYS.uploadHistory, (prev: any) => {
        const current = Array.isArray(prev) ? prev : []
        return current.filter((historyItem: any) => historyItem.id !== batchId)
      })
      return { previousHistory }
    },
    onError: (_error, _batchId, context) => {
      if (context?.previousHistory) {
        queryClient.setQueryData(QUERY_KEYS.uploadHistory, context.previousHistory)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.uploadHistory })
    },
  })

  const addFiles = useCallback((files: FileList | File[]) => {
    const newItems: QueueItem[] = Array.from(files)
      .filter(f => /\.(xlsx|xls|csv)$/i.test(f.name))
      .map(file => {
        const parsed = parseFileName(file.name)
        return {
          file,
          status: 'pending' as const,
          furnaceNo: parsed.furnaceNo,
          periodStart: parsed.periodStart || undefined,
          periodEnd: parsed.periodEnd || undefined,
        }
      })

    if (newItems.length === 0) return
    setQueue(prev => [...prev, ...newItems])
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    addFiles(e.dataTransfer.files)
  }, [addFiles])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files)
    e.target.value = ''
  }

  const processQueue = async () => {
    if (duplicateMode === 'upsert' && !showUpsertConfirm) {
      setShowUpsertConfirm(true)
      return
    }
    setShowUpsertConfirm(false)
    setIsProcessing(true)
    const pendingItems = queue.filter(q => q.status === 'pending')

    for (let i = 0; i < pendingItems.length; i++) {
      const item = pendingItems[i]
      const idx = queue.indexOf(item)
      let optimisticHistoryId = ''

      setQueue(prev => prev.map((q, j) => j === idx ? { ...q, status: 'uploading' } : q))

      try {
        const furnace = furnaces?.find((f: any) => f.no === item.furnaceNo)
        if (!furnace) {
          throw new Error('가열로 번호를 선택해 주세요')
        }

        optimisticHistoryId = addOptimisticHistoryItem(item, furnace)
        const formData = new FormData()
        formData.append('file', item.file)
        formData.append('furnaceId', String(furnace.id))
        formData.append('duplicateMode', duplicateMode)

        const res = await api.post('/gas-readings/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })

        const result = res.data
        if (result?.status === 'completed') {
          queryClient.setQueryData(QUERY_KEYS.uploadHistory, (prev: any) => {
            const current = Array.isArray(prev) ? prev : []
            const finalHistoryItem = {
              id: result.batchId,
              tempId: optimisticHistoryId,
              fileName: item.file.name,
              furnaceId: furnace.id,
              furnace,
              periodStart: item.periodStart ? new Date(item.periodStart).toISOString() : null,
              periodEnd: item.periodEnd ? new Date(item.periodEnd).toISOString() : null,
              rowCount: result.totalRows,
              successCount: result.successCount,
              errorCount: result.errorCount,
              createdAt: new Date().toISOString(),
            }

            return [finalHistoryItem, ...current.filter((historyItem: any) => historyItem.id !== optimisticHistoryId)]
          })
        } else {
          queryClient.setQueryData(QUERY_KEYS.uploadHistory, (prev: any) => {
            const current = Array.isArray(prev) ? prev : []
            return current.filter((historyItem: any) => historyItem.id !== optimisticHistoryId)
          })
        }

        setQueue(prev => prev.map((q, j) => j === idx ? {
          ...q,
          status: result.status === 'completed' ? 'completed' : 'error',
          result,
          error: result.error,
        } : q))
      } catch (err: any) {
        queryClient.setQueryData(QUERY_KEYS.uploadHistory, (prev: any) => {
          const current = Array.isArray(prev) ? prev : []
          return current.filter((historyItem: any) => historyItem.id !== optimisticHistoryId)
        })

        setQueue(prev => prev.map((q, j) => j === idx ? {
          ...q,
          status: 'error',
          error: err.response?.data?.message || err.message,
        } : q))
      }
    }

    setIsProcessing(false)
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.gasReadings })
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.uploadHistory })
  }

  const clearQueue = () => setQueue([])
  const clearCompleted = () => setQueue(prev => prev.filter(q => q.status !== 'completed'))

  const updateItemFurnace = (index: number, furnaceNo: number | null) => {
    setQueue(prev => prev.map((q, i) => i === index ? { ...q, furnaceNo } : q))
  }

  const pendingCount = queue.filter(q => q.status === 'pending').length
  const completedCount = queue.filter(q => q.status === 'completed').length
  const errorCount = queue.filter(q => q.status === 'error').length
  const resolveHistoryFurnaceName = (historyItem: any) => {
    if (historyItem.furnace?.name) {
      return historyItem.furnace.name
    }

    const parsed = parseFileName(historyItem.fileName || '')
    if (parsed.furnaceNo) {
      return `가열${parsed.furnaceNo}호`
    }

    return '-'
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">가스 데이터 다중 업로드</h1>

      {/* Drop Zone */}
      <div
        className="border-2 border-dashed rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer mb-6"
        role="button"
        tabIndex={0}
        aria-label="파일 업로드 영역"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click() } }}
      >
        <input ref={fileInputRef} type="file" multiple accept=".xlsx,.xls,.csv" className="hidden"
          onChange={handleFileInput} />
        <FileSpreadsheet className="mx-auto h-10 w-10 text-gray-400 mb-2" />
        <p className="font-medium text-gray-700">여러 Excel/CSV 파일을 드래그 앤 드롭</p>
        <p className="text-sm text-gray-500 mt-1">또는 클릭하여 파일 선택 (다중 선택 가능)</p>
        <p className="text-xs text-gray-400 mt-2">
          파일명에 호기/기간 포함 시 자동 추출: 17호기_가스_(2026-06-01 ~ 2026-06-30).xlsx
        </p>
      </div>

      {/* Queue Controls */}
      {queue.length > 0 && (
        <div className="bg-white shadow rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-600">전체 {queue.length}건</span>
              {completedCount > 0 && <span className="text-green-600">완료 {completedCount}건</span>}
              {errorCount > 0 && <span className="text-red-600">실패 {errorCount}건</span>}
              {pendingCount > 0 && <span className="text-gray-400">대기 {pendingCount}건</span>}
            </div>
            <div className="flex gap-2">
              <select value={duplicateMode} onChange={(e) => setDuplicateMode(e.target.value as any)}
                className="text-sm border rounded px-2 py-1">
                <option value="skip">중복 건너뛰기</option>
                <option value="upsert">중복 덮어쓰기</option>
              </select>
              <button onClick={clearCompleted} className="text-sm text-gray-500 hover:text-gray-700">완료 삭제</button>
              <button onClick={clearQueue} className="text-sm text-gray-500 hover:text-gray-700">전체 삭제</button>
              <button onClick={processQueue} disabled={isProcessing || pendingCount === 0}
                className="inline-flex items-center px-4 py-1.5 border border-transparent rounded text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                {isProcessing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                {isProcessing ? '처리 중...' : '업로드 시작'}
              </button>
            </div>
          </div>

          {/* Queue List */}
          <div className="space-y-2 max-h-96 overflow-auto">
            {queue.map((item, idx) => {
              const cfg = STATUS_CONFIG[item.status]
              const Icon = cfg.icon
              return (
                <div key={idx} className={`flex items-center gap-3 p-3 rounded-lg ${cfg.bg} border`}>
                  <Icon className={`h-5 w-5 ${cfg.color} ${item.status === 'uploading' ? 'animate-spin' : ''}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.file.name}</p>
                    <p className="text-xs text-gray-500">
                      {item.furnaceNo ? `가열${item.furnaceNo}호` : '호기 미추출'}
                      {item.periodStart && ` · ${item.periodStart} ~ ${item.periodEnd}`}
                    </p>
                  </div>
                  {item.status === 'pending' && (
                    <select
                      value={item.furnaceNo ?? ''}
                      onChange={(e) => updateItemFurnace(idx, e.target.value ? Number(e.target.value) : null)}
                      className="text-xs border rounded px-2 py-1"
                    >
                      <option value="">가열로 선택</option>
                      {furnaces?.map((f: any) => <option key={f.no} value={f.no}>{f.name}</option>)}
                    </select>
                  )}
                  {item.result && (
                    <span className="text-xs text-gray-500">
                      {item.result.successCount?.toLocaleString()}행 성공
                      {item.result.duplicateCount > 0 && `, ${item.result.duplicateCount} 중복`}
                    </span>
                  )}
                  {item.error && <span className="text-xs text-red-500">{item.error}</span>}
                  <span className="text-xs text-gray-400">{cfg.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Upload History */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-700">업로드 이력</h3>
        </div>
        <div className="overflow-x-auto max-h-64">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">파일명</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">가열로</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">행 수</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">성공</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">실패</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">업로드 시간</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {uploadHistory?.map((h: any) => (
                <tr key={h.id} className={h.isOptimistic ? 'bg-blue-50/70 animate-pulse' : 'hover:bg-gray-50'}>
                  <td className="px-3 py-2 text-blue-600">{h.fileName}</td>
                  <td className="px-3 py-2">{resolveHistoryFurnaceName(h)}</td>
                  <td className="px-3 py-2 text-right">{h.rowCount != null ? h.rowCount.toLocaleString() : h.isOptimistic ? '업로드 중' : '-'}</td>
                  <td className="px-3 py-2 text-right text-green-600">{h.successCount != null ? h.successCount.toLocaleString() : '-'}</td>
                  <td className="px-3 py-2 text-right text-red-600">{h.errorCount != null ? h.errorCount.toLocaleString() : '-'}</td>
                  <td className="px-3 py-2 text-gray-500">
                    <div className="flex items-center justify-between gap-2">
                      <span>{h.isOptimistic ? '업로드 중...' : new Date(h.createdAt).toLocaleString()}</span>
                      {!h.isOptimistic && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(h)}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                        aria-label={`${h.fileName} 삭제`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        삭제
                      </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {(!uploadHistory || uploadHistory.length === 0) && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">업로드 이력이 없습니다</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={showUpsertConfirm}
        title="덮어쓰기 확인"
        message="덮어쓰기 모드로 업로드하면 기존 데이터가 새로운 데이터로 대체됩니다. 계속하시겠습니까?"
        confirmLabel="덮어쓰기"
        danger
        onConfirm={processQueue}
        onCancel={() => setShowUpsertConfirm(false)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="업로드 이력 삭제"
        message={deleteTarget ? `"${deleteTarget.fileName}" 업로드 이력과 연결된 가스 데이터를 삭제합니다. 계속하시겠습니까?` : ''}
        confirmLabel={deleteUploadHistoryMutation.isPending ? '삭제 중...' : '삭제'}
        danger
        onConfirm={() => {
          if (deleteTarget !== null) {
            deleteUploadHistoryMutation.mutate(deleteTarget.id)
            setDeleteTarget(null)
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
