import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useToast } from '@/components/Toast'
import { format } from 'date-fns'
import { AlertTriangle, CheckCircle, RefreshCw, Edit2, FileText, ArrowRight } from 'lucide-react'

export function RematchPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<any>({})

  const { data: unmatched, isLoading: loadingUnmatched } = useQuery({
    queryKey: ['unmatched-records'],
    queryFn: () => api.get('/charges/unmatched').then(r => r.data),
  })

  const { data: allRecords } = useQuery({
    queryKey: ['charge-records'],
    queryFn: () => api.get('/uploads/charge-records').then(r => r.data),
  })

  const rematchAllMutation = useMutation({
    mutationFn: () => api.post('/charges/rematch-all').then(r => r.data),
    onSuccess: (data) => {
      const matched = data.filter((r: any) => r.status === 'matched').length
      const failed = data.filter((r: any) => r.status === 'failed').length
      toast('success', `재매칭 완료: ${matched}건 성공, ${failed}건 실패`)
      queryClient.invalidateQueries({ queryKey: ['unmatched-records'] })
      queryClient.invalidateQueries({ queryKey: ['charges'] })
    },
    onError: () => toast('error', '재매칭 중 오류 발생'),
  })

  const updateRecordMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      api.put(`/charges/record/${id}`, data).then(r => r.data),
    onSuccess: () => {
      toast('success', '레코드가 수정되고 사용량이 재계산되었습니다')
      setEditingId(null)
      queryClient.invalidateQueries({ queryKey: ['unmatched-records'] })
      queryClient.invalidateQueries({ queryKey: ['charges'] })
    },
    onError: () => toast('error', '수정 중 오류 발생'),
  })

  const startEdit = (record: any) => {
    setEditingId(record.id)
    setEditForm({
      furnaceId: record.furnaceId,
      workDate: format(new Date(record.workDate), 'yyyy-MM-dd'),
      shift: record.shift,
      workEnd: record.workEnd ? format(new Date(record.workEnd), "yyyy-MM-dd'T'HH:mm") : '',
      material: record.material || '',
      weightKg: record.weightKg || '',
      note: record.note || '',
    })
  }

  const saveEdit = () => {
    if (!editingId) return
    updateRecordMutation.mutate({ id: editingId, data: editForm })
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">장입도 매칭 관리</h1>
        <button onClick={() => rematchAllMutation.mutate()}
          disabled={rematchAllMutation.isPending}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 mr-1 ${rematchAllMutation.isPending ? 'animate-spin' : ''}`} />
          전체 재매칭
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-blue-800">
        <p><strong>매칭 원칙:</strong> PDF 파일명/업로드 시각이 아닌, 장입도에 기재된 <strong>실제 작업일자·가열로 호기·주간/야간·수기 종료시간</strong>을 기준으로 가스 사용량을 매칭합니다.</p>
        <p className="mt-1">작업일자를 수정하면 자동으로 가스 시계열에서 해당 구간의 가스누적지침을 찾아 사용량을 재계산합니다.</p>
      </div>

      {/* Unmatched Records */}
      <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700 flex items-center">
            <AlertTriangle className="h-4 w-4 mr-1 text-orange-500" />
            미매칭 / 확인 필요 ({unmatched?.length || 0}건)
          </h3>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">PDF</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">페이지</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">작업일</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">호기</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">교대</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">종료시간</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loadingUnmatched ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">로딩 중...</td></tr>
              ) : !unmatched?.length ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                  미매칭 레코드가 없습니다
                </td></tr>
              ) : unmatched.map((r: any) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <span className="text-blue-600 text-xs">{r.chargeScan?.originalFileName}</span>
                  </td>
                  <td className="px-3 py-2">{r.pageIndex}</td>
                  <td className="px-3 py-2">{format(new Date(r.workDate), 'yyyy-MM-dd')}</td>
                  <td className="px-3 py-2">{r.furnace?.name || `호기${r.furnaceId}`}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${r.shift === 'day' ? 'bg-yellow-100 text-yellow-800' : 'bg-indigo-100 text-indigo-800'}`}>
                      {r.shift === 'day' ? '주간' : '야간'}
                    </span>
                  </td>
                  <td className="px-3 py-2">{r.workEnd ? format(new Date(r.workEnd), 'HH:mm') : '-'}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => startEdit(r)}
                      className="text-blue-600 hover:text-blue-800">
                      <Edit2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* All Records */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 flex items-center">
            <FileText className="h-4 w-4 mr-1" />
            전체 장입도 레코드 ({allRecords?.length || 0}건)
          </h3>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">PDF</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">작업일</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">호기</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">교대</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">종료시간</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">상태</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {allRecords?.map((r: any) => {
                const isLinked = r.chargeEntries?.length > 0
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs text-blue-600">{r.chargeScan?.originalFileName}</td>
                    <td className="px-3 py-2">{format(new Date(r.workDate), 'yyyy-MM-dd')}</td>
                    <td className="px-3 py-2">{r.furnace?.name}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${r.shift === 'day' ? 'bg-yellow-100 text-yellow-800' : 'bg-indigo-100 text-indigo-800'}`}>
                        {r.shift === 'day' ? '주간' : '야간'}
                      </span>
                    </td>
                    <td className="px-3 py-2">{r.workEnd ? format(new Date(r.workEnd), 'HH:mm') : '-'}</td>
                    <td className="px-3 py-2">
                      {isLinked ? (
                        <span className="inline-flex items-center text-xs text-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />연결됨
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs text-orange-500">
                          <AlertTriangle className="h-3 w-3 mr-1" />미연결
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => startEdit(r)}
                        className="text-blue-600 hover:text-blue-800">
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">레코드 수정</h3>
              <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">작업일자</label>
                <input type="date" value={editForm.workDate}
                  onChange={(e) => setEditForm({ ...editForm, workDate: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
                <p className="text-xs text-gray-400 mt-1">작업일자를 수정하면 가스 사용량이 자동 재계산됩니다</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">가열로</label>
                <select value={editForm.furnaceId}
                  onChange={(e) => setEditForm({ ...editForm, furnaceId: Number(e.target.value) })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm">
                  {[1,2,3,4,5,6,8,9,10,11,12,13,14,15,16,17,18,19,20].map(n => (
                    <option key={n} value={n}>가열{n}호</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">주간/야간</label>
                <select value={editForm.shift}
                  onChange={(e) => setEditForm({ ...editForm, shift: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm">
                  <option value="day">주간</option>
                  <option value="night">야간</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">수기 종료 시간</label>
                <input type="datetime-local" value={editForm.workEnd}
                  onChange={(e) => setEditForm({ ...editForm, workEnd: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">재질/품번</label>
                  <input type="text" value={editForm.material}
                    onChange={(e) => setEditForm({ ...editForm, material: e.target.value })}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">중량 (kg)</label>
                  <input type="number" value={editForm.weightKg}
                    onChange={(e) => setEditForm({ ...editForm, weightKg: e.target.value })}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">비고</label>
                <input type="text" value={editForm.note}
                  onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setEditingId(null)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                취소
              </button>
              <button onClick={saveEdit} disabled={updateRecordMutation.isPending}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                <ArrowRight className="h-4 w-4 mr-1" />
                {updateRecordMutation.isPending ? '저장 중...' : '저장 및 재매칭'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
