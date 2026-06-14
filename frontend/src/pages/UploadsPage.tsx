import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { format } from 'date-fns'
import { Upload, FileText, Trash2, Eye, Plus } from 'lucide-react'
import { PdfViewer } from '@/components/PdfViewer'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'

export function UploadsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [selectedScan, setSelectedScan] = useState<any>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [showRecordForm, setShowRecordForm] = useState(false)
  const [recordForm, setRecordForm] = useState({
    chargeScanId: 0,
    pageIndex: 1,
    furnaceId: 0,
    workDate: format(new Date(), 'yyyy-MM-dd'),
    shift: 'day',
    workEnd: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    material: '',
    weightKg: '',
    note: '',
  })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedScan) { setSelectedScan(null); setPdfUrl(null) }
        else if (deleteId) setDeleteId(null)
        else if (showRecordForm) setShowRecordForm(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedScan, deleteId, showRecordForm])

  const { data: furnaces } = useQuery({
    queryKey: ['furnaces'],
    queryFn: () => api.get('/furnaces').then((res) => Array.isArray(res.data) ? res.data : []),
  })

  const { data: scans, isLoading } = useQuery({
    queryKey: ['charge-scans'],
    queryFn: () => api.get('/uploads/pdf').then((res) => Array.isArray(res.data) ? res.data : []),
  })

  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const formData = new FormData()
      Array.from(files).forEach((file) => formData.append('files', file))
      
      return api.post('/uploads/pdf/batch', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1))
          setUploadProgress((prev) => ({ ...prev, batch: progress }))
        },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['charge-scans'] })
      setUploadProgress({})
    },
    onError: () => {
      setUploadProgress({})
      toast('error', 'PDF 업로드 중 오류가 발생했습니다')
    },
  })

  const createRecordMutation = useMutation({
    mutationFn: async (data: any) => {
      return api.post('/uploads/charge-record', data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['charge-records'] })
      setShowRecordForm(false)
    },
    onError: () => toast('error', '기록 생성 중 오류가 발생했습니다'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return api.delete(`/uploads/pdf/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['charge-scans'] })
    },
    onError: () => toast('error', '삭제 중 오류가 발생했습니다'),
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      uploadMutation.mutate(files)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      uploadMutation.mutate(files)
    }
  }

  const handleViewPdf = async (scan: any) => {
    setSelectedScan(scan)
    try {
      const res = await api.get(`/uploads/pdf/${scan.id}/url`)
      setPdfUrl(res.data.url)
    } catch {
      setPdfUrl(null)
    }
  }

  const handleCreateRecord = () => {
    createRecordMutation.mutate({
      ...recordForm,
      chargeScanId: selectedScan?.id,
      furnaceId: parseInt(String(recordForm.furnaceId)),
      weightKg: recordForm.weightKg ? parseFloat(recordForm.weightKg) : undefined,
    })
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">장입도 업로드</h1>
      </div>

      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center mb-6 transition-colors ${
          uploadProgress.batch ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf"
          className="hidden"
          onChange={handleFileChange}
        />
        <Upload className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-sm text-gray-600">
          PDF 파일을 드래그 앤 드롭하거나 클릭하여 업로드
        </p>
        <p className="mt-1 text-xs text-gray-500">여러 파일 동시 업로드 가능</p>
        {uploadProgress.batch && (
          <div className="mt-4">
            <div className="bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${uploadProgress.batch}%` }}
              />
            </div>
            <p className="mt-1 text-sm text-gray-600">{uploadProgress.batch}% 업로드 중...</p>
          </div>
        )}
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">업로드된 PDF</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">파일명</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">페이지 수</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">업로드 시간</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">작업</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                    로딩 중...
                  </td>
                </tr>
              ) : scans?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                    업로드된 PDF가 없습니다
                  </td>
                </tr>
              ) : (
                scans?.map((scan: any) => (
                  <tr key={scan.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-900">{scan.originalFileName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{scan.pageCount}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {format(new Date(scan.uploadedAt), 'yyyy-MM-dd HH:mm')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        scan.status === 'uploaded' ? 'bg-green-100 text-green-800' :
                        scan.status === 'error' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {scan.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => handleViewPdf(scan)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteId(scan.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedScan && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-label="PDF 뷰어">
          <div className="bg-white rounded-lg shadow-xl w-[90vw] h-[90vh] flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
              <h3 className="text-lg font-medium text-gray-900">{selectedScan.originalFileName}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowRecordForm(true)}
                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  기록 추가
                </button>
                <button
                  onClick={() => { setSelectedScan(null); setPdfUrl(null) }}
                  className="text-gray-400 hover:text-gray-500 text-lg px-2"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              {pdfUrl ? (
                <PdfViewer url={pdfUrl} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  PDF 로딩 중...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showRecordForm && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-label="장입도 기록 추가">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">장입도 기록 추가</h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">페이지 번호</label>
                <input
                  type="number"
                  value={recordForm.pageIndex}
                  onChange={(e) => setRecordForm({ ...recordForm, pageIndex: parseInt(e.target.value) })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">가열로</label>
                <select
                  value={recordForm.furnaceId}
                  onChange={(e) => setRecordForm({ ...recordForm, furnaceId: parseInt(e.target.value) })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="0">선택</option>
                  {furnaces?.map((f: any) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">작업일</label>
                <input
                  type="date"
                  value={recordForm.workDate}
                  onChange={(e) => setRecordForm({ ...recordForm, workDate: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">주간/야간</label>
                <select
                  value={recordForm.shift}
                  onChange={(e) => setRecordForm({ ...recordForm, shift: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="day">주간</option>
                  <option value="night">야간</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">작업 종료 시간</label>
                <input
                  type="datetime-local"
                  value={recordForm.workEnd}
                  onChange={(e) => setRecordForm({ ...recordForm, workEnd: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">재질/품번</label>
                <input
                  type="text"
                  value={recordForm.material}
                  onChange={(e) => setRecordForm({ ...recordForm, material: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">중량 (kg)</label>
                <input
                  type="number"
                  value={recordForm.weightKg}
                  onChange={(e) => setRecordForm({ ...recordForm, weightKg: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  step="0.1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">비고</label>
                <input
                  type="text"
                  value={recordForm.note}
                  onChange={(e) => setRecordForm({ ...recordForm, note: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setShowRecordForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleCreateRecord}
                disabled={!recordForm.furnaceId || createRecordMutation.isPending}
                className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {createRecordMutation.isPending ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title="PDF 삭제"
        message="이 PDF 파일을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        confirmLabel="삭제"
        danger
        onConfirm={() => { if (deleteId) { deleteMutation.mutate(deleteId); setDeleteId(null) } }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
