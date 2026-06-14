import { useState, useCallback, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { format } from 'date-fns'
import { Save, Trash2, Plus, Clipboard, AlertTriangle, Wand2, ExternalLink } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { TableSkeleton } from '@/components/Skeleton'

interface ChargeRow {
  id?: number
  chargeNo: string
  furnaceNo: number | ''
  gasBefore: number | ''
  gasAfter: number | ''
  usage: number | null
  workDate: string
  shift: string
  source: string
  note: string
  _errors?: string[]
  _autoFilled?: boolean
}

function generateChargeNo(date: Date, sequence: number): string {
  const yy = String(date.getFullYear()).slice(-2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const nnn = String(sequence).padStart(3, '0')
  return `${yy}${mm}${dd}-${nnn}`
}

export function ChargesPage() {
  const queryClient = useQueryClient()
  const [rows, setRows] = useState<ChargeRow[]>([])
  const [furnaceId, setFurnaceId] = useState<number | ''>('')
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [autoFilling, setAutoFilling] = useState<number | null>(null)
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (hasUnsavedChanges) saveAll()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        addRow()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hasUnsavedChanges])

  const validateRow = (row: ChargeRow): string[] => {
    const errors: string[] = []
    if (!row.chargeNo) errors.push('차지번호 필수')
    else if (!/^\d{6}-\d{3,}$/.test(row.chargeNo)) errors.push('차지번호 형식: YYMMDD-NNN')
    if (row.furnaceNo === '' || !row.furnaceNo) errors.push('가열로 선택 필수')
    const gb = row.gasBefore === '' ? null : Number(row.gasBefore)
    const ga = row.gasAfter === '' ? null : Number(row.gasAfter)
    if (gb !== null && ga !== null && ga < gb) errors.push('사용후 < 사용전 (음수 사용량)')
    return errors
  }

  const validateAllRows = (r: ChargeRow[]): ChargeRow[] => r.map(row => ({ ...row, _errors: validateRow(row) }))

  const { data: furnaces } = useQuery({
    queryKey: ['furnaces'],
    queryFn: () => api.get('/furnaces').then((res) => res.data),
  })

  const { isLoading } = useQuery({
    queryKey: ['charges', furnaceId, startDate, endDate],
    queryFn: () => {
      const params = new URLSearchParams()
      if (furnaceId) params.append('furnaceId', String(furnaceId))
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate + 'T23:59:59')
      return api.get(`/charges?${params.toString()}`).then((res) => {
        const data = res.data.map((c: any) => ({
          id: c.id,
          chargeNo: c.chargeNo,
          furnaceNo: c.furnace?.no || '',
          gasBefore: c.gasBefore ?? '',
          gasAfter: c.gasAfter ?? '',
          usage: c.usage,
          workDate: format(new Date(c.workDate), 'yyyy-MM-dd'),
          shift: c.shift,
          source: c.source,
          note: c.note || '',
        }))
        const validated = validateAllRows(data)
        setRows(validated)
        return validated
      })
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (data: { updates: any[] }) => api.post('/charges/bulk-update', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['charges'] })
      setHasUnsavedChanges(false)
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: any) => api.post('/charges', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['charges'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/charges/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['charges'] }),
  })

  const pasteMutation = useMutation({
    mutationFn: async (data: { rows: any[] }) => api.post('/charges/paste', data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['charges'] })
      setHasUnsavedChanges(false)
      return res.data
    },
  })

  const autoFillMutation = useMutation({
    mutationFn: async (data: { furnaceId: number; workDate: string; shift: string }) =>
      api.post('/charges/auto-fill', data).then(r => r.data),
  })

  const handleCellChange = useCallback((index: number, field: keyof ChargeRow, value: any) => {
    setRows((prev) => {
      const newRows = [...prev]
      const row = { ...newRows[index] }
      if (field === 'gasBefore' || field === 'gasAfter') {
        row[field] = value === '' ? '' : parseFloat(value) || ''
        const gb = row.gasBefore === '' ? null : Number(row.gasBefore)
        const ga = row.gasAfter === '' ? null : Number(row.gasAfter)
        row.usage = gb !== null && ga !== null ? ga - gb : null
      } else if (field === 'furnaceNo') {
        row[field] = value === '' ? '' : parseInt(value) || ''
      } else {
        (row as any)[field] = value
      }
      newRows[index] = row
      return validateAllRows(newRows)
    })
    setHasUnsavedChanges(true)
  }, [])

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    const lines = text.split('\n').filter(l => l.trim())
    const pasteRows = lines.map(line => {
      const cols = line.split('\t')
      return {
        chargeNo: cols[0] || '',
        furnaceNo: parseInt(cols[1]) || 0,
        gasBefore: parseFloat(cols[2]) || undefined,
        gasAfter: parseFloat(cols[3]) || undefined,
        note: cols[4] || '',
      }
    }).filter(r => r.chargeNo && r.furnaceNo)

    if (pasteRows.length > 0) {
      const res = await pasteMutation.mutateAsync({ rows: pasteRows })
      const result = res.data
      if (Array.isArray(result) && result.length) {
        setRows(prev => validateAllRows([...prev, ...result.map((r: any) => ({
          id: r.id,
          chargeNo: r.chargeNo,
          furnaceNo: r.furnaceNo,
          gasBefore: r.gasBefore ?? '',
          gasAfter: r.gasAfter ?? '',
          usage: r.usage ?? null,
          workDate: r.workDate ? format(new Date(r.workDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
          shift: r.shift || 'day',
          source: 'paste',
          note: r.note || '',
        }))]))
      }
    } else {
      const newRows: ChargeRow[] = lines.map(line => {
        const cols = line.split('\t')
        return {
          chargeNo: cols[0] || '',
          furnaceNo: parseInt(cols[1]) || '',
          gasBefore: parseFloat(cols[2]) || '',
          gasAfter: parseFloat(cols[3]) || '',
          usage: null,
          workDate: format(new Date(), 'yyyy-MM-dd'),
          shift: 'day',
          source: 'paste',
          note: cols[4] || '',
        }
      })
      setRows(prev => validateAllRows([...prev, ...newRows]))
    }
    setHasUnsavedChanges(true)
  }, [pasteMutation])

  const addRow = () => {
    const today = new Date()
    const seq = rows.filter(r => r.workDate === format(today, 'yyyy-MM-dd')).length + 1
    setRows(prev => validateAllRows([
      ...prev,
      {
        chargeNo: generateChargeNo(today, seq),
        furnaceNo: '',
        gasBefore: '',
        gasAfter: '',
        usage: null,
        workDate: format(today, 'yyyy-MM-dd'),
        shift: 'day',
        source: 'manual',
        note: '',
      },
    ]))
    setHasUnsavedChanges(true)
  }

  const deleteRow = (index: number) => {
    setDeleteIndex(index)
  }

  const confirmDelete = () => {
    if (deleteIndex === null) return
    const row = rows[deleteIndex]
    if (row.id) deleteMutation.mutate(row.id)
    setRows(prev => validateAllRows(prev.filter((_, i) => i !== deleteIndex)))
    setHasUnsavedChanges(true)
    setDeleteIndex(null)
  }

  const saveAll = () => {
    const existing = rows.filter(r => r.id).map(r => ({
      id: r.id,
      gasBefore: r.gasBefore === '' ? null : r.gasBefore,
      gasAfter: r.gasAfter === '' ? null : r.gasAfter,
      note: r.note,
    }))
    const newOnes = rows.filter(r => !r.id).map(r => ({
      chargeNo: r.chargeNo,
      furnaceId: furnaces?.find((f: any) => f.no === r.furnaceNo)?.id || 1,
      gasBefore: r.gasBefore === '' ? null : r.gasBefore,
      gasAfter: r.gasAfter === '' ? null : r.gasAfter,
      workDate: r.workDate,
      shift: r.shift,
      source: r.source,
      note: r.note,
    }))

    if (existing.length > 0) saveMutation.mutate({ updates: existing })
    newOnes.forEach(r => createMutation.mutate(r))
    setHasUnsavedChanges(false)
  }

  const handleAutoFill = async (index: number) => {
    const row = rows[index]
    if (!row.furnaceNo || !row.workDate) return
    const furnace = furnaces?.find((f: any) => f.no === row.furnaceNo)
    if (!furnace) return

    setAutoFilling(index)
    try {
      const result = await autoFillMutation.mutateAsync({
        furnaceId: furnace.id,
        workDate: row.workDate,
        shift: row.shift,
      })
      if (result) {
        setRows(prev => {
          const newRows = [...prev]
          newRows[index] = {
            ...newRows[index],
            gasBefore: result.gasBefore,
            gasAfter: result.gasAfter,
            usage: result.usage,
            _autoFilled: true,
          }
          return validateAllRows(newRows)
        })
        setHasUnsavedChanges(true)
      }
    } finally {
      setAutoFilling(null)
    }
  }

  const handleAutoFillAll = async () => {
    const targets = rows.filter(r => r.furnaceNo && r.workDate && !r.gasBefore && !r.gasAfter)
    for (let i = 0; i < targets.length; i++) {
      const idx = rows.indexOf(targets[i])
      await handleAutoFill(idx)
    }
  }

  const handleExport = () => {
    const headers = ['차지번호', '가열로', '사용전', '사용후', '사용량', '날짜', '주간/야간', '비고']
    const data = rows.map(r => [
      r.chargeNo, r.furnaceNo, r.gasBefore, r.gasAfter,
      r.usage ?? '', r.workDate, r.shift === 'day' ? '주간' : '야간', r.note,
    ])
    const csv = [headers, ...data].map(row => row.join('\t')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `charges-${format(new Date(), 'yyyyMMdd')}.csv`
    a.click()
  }

  const errorCount = rows.filter(r => r._errors?.length).length

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">차지 사용량</h1>
        <div className="flex gap-2">
          <button onClick={handleExport}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
            내보내기
          </button>
          <button onClick={handleAutoFillAll}
            disabled={autoFilling !== null}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
            <Wand2 className="h-4 w-4 mr-1" />
            전체 자동채움
          </button>
          {hasUnsavedChanges && (
            <button onClick={saveAll} disabled={saveMutation.isPending}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50">
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? '저장 중...' : '저장'}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">가열로</label>
            <select value={furnaceId} onChange={(e) => setFurnaceId(e.target.value ? Number(e.target.value) : '')}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm">
              <option value="">전체</option>
              {furnaces?.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
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
          <button onClick={addRow}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />행 추가
          </button>
        </div>
      </div>

      <div ref={gridRef} className="bg-white shadow rounded-lg overflow-hidden" onPaste={handlePaste} tabIndex={0}>
        <div className="px-4 py-2 text-sm flex items-center justify-between border-b">
          <span className="text-blue-700 flex items-center">
            <Clipboard className="h-4 w-4 mr-2" />
            엑셀에서 복사 → 여기에 붙여넣기 (차지번호, 가열로, 사용전, 사용후, 비고)
          </span>
          {errorCount > 0 && (
            <span className="text-red-600 flex items-center">
              <AlertTriangle className="h-4 w-4 mr-1" />
              검증 오류 {errorCount}건
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">차지번호</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">가열로</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">사용전</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">사용후</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">사용량</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">날짜</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">교대</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">비고</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">작업</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan={9} className="px-4 py-12"><TableSkeleton rows={5} cols={9} /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                  데이터가 없습니다. 행을 추가하거나 클립보드에서 붙여넣기 하세요.
                </td></tr>
              ) : rows.map((row, index) => (
                <tr key={index} className={`hover:bg-gray-50 ${row._errors?.length ? 'bg-red-50' : ''} ${row._autoFilled ? 'bg-green-50' : ''}`}>
                  <td className="px-3 py-1.5">
                    {row.id ? (
                      <Link to={`/charges/${row.id}`}
                        className={`inline-flex items-center text-sm font-medium hover:underline ${row._errors?.some(e => e.includes('차지번호')) ? 'text-red-600' : 'text-blue-600'}`}>
                        {row.chargeNo}
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Link>
                    ) : (
                      <input type="text" value={row.chargeNo}
                        onChange={(e) => handleCellChange(index, 'chargeNo', e.target.value)}
                        className={`w-full border-0 focus:ring-0 text-sm p-0 ${row._errors?.some(e => e.includes('차지번호')) ? 'text-red-600 font-bold' : ''}`}
                        placeholder="YYMMDD-NNN" />
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <select value={row.furnaceNo}
                      onChange={(e) => handleCellChange(index, 'furnaceNo', e.target.value)}
                      className="w-full border-0 focus:ring-0 text-sm p-0">
                      <option value="">선택</option>
                      {furnaces?.map((f: any) => <option key={f.no} value={f.no}>{f.name}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="number" value={row.gasBefore}
                      onChange={(e) => handleCellChange(index, 'gasBefore', e.target.value)}
                      className="w-full border-0 focus:ring-0 text-sm p-0" step="0.01" />
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="number" value={row.gasAfter}
                      onChange={(e) => handleCellChange(index, 'gasAfter', e.target.value)}
                      className="w-full border-0 focus:ring-0 text-sm p-0" step="0.01" />
                  </td>
                  <td className="px-3 py-1.5 text-sm font-medium">
                    {row.usage != null ? (
                      <span className={row.usage < 0 ? 'text-red-600' : 'text-gray-900'}>
                        {row.usage.toFixed(2)}
                        {row._autoFilled && <span className="text-xs text-green-600 ml-1">auto</span>}
                      </span>
                    ) : '-'}
                    {row._errors?.some(e => e.includes('음수')) && (
                      <AlertTriangle className="inline h-3 w-3 text-red-500 ml-1" />
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="date" value={row.workDate}
                      onChange={(e) => handleCellChange(index, 'workDate', e.target.value)}
                      className="w-full border-0 focus:ring-0 text-sm p-0" />
                  </td>
                  <td className="px-3 py-1.5">
                    <select value={row.shift}
                      onChange={(e) => handleCellChange(index, 'shift', e.target.value)}
                      className="w-full border-0 focus:ring-0 text-sm p-0">
                      <option value="day">주간</option>
                      <option value="night">야간</option>
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="text" value={row.note}
                      onChange={(e) => handleCellChange(index, 'note', e.target.value)}
                      className="w-full border-0 focus:ring-0 text-sm p-0" />
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <button onClick={() => handleAutoFill(index)} disabled={autoFilling === index || !row.furnaceNo}
                      className="text-blue-600 hover:text-blue-900 mr-1 disabled:opacity-30" title="자동채움">
                      {autoFilling === index ? (
                        <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                      ) : (
                        <Wand2 className="h-4 w-4" />
                      )}
                    </button>
                    <button onClick={() => deleteRow(index)} className="text-red-600 hover:text-red-900">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length > 0 && (
          <div className="px-4 py-3 bg-gray-50 border-t text-sm text-gray-600 flex justify-between">
            <span>총 {rows.length}건</span>
            <span>
              전체 사용량: {rows.reduce((sum, r) => sum + (r.usage || 0), 0).toFixed(2)}
            </span>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteIndex !== null}
        title="행 삭제"
        message="이 차지 행을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        confirmLabel="삭제"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteIndex(null)}
      />
    </div>
  )
}
