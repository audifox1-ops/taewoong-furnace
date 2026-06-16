import { useState } from 'react'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'

interface ExportButtonProps {
  headers: string[]
  rows: (string | number | null | undefined)[][]
  filename: string
  label?: string
  excelUrl?: string
}

export function ExportButton({ headers, rows, filename, label = '내보내기', excelUrl }: ExportButtonProps) {
  const [showMenu, setShowMenu] = useState(false)

  const handleExportCsv = () => {
    const tsv = [headers, ...rows.map(r => r.map(v => v ?? '').join('\t'))].join('\n')
    const bom = '\ufeff'
    const blob = new Blob([bom + tsv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setShowMenu(false)
  }

  const handleExportExcel = () => {
    if (excelUrl) {
      window.location.href = excelUrl
    }
    setShowMenu(false)
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        aria-label={label}
      >
        <Download className="h-4 w-4 mr-1" />
        {label}
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 z-20 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg">
            <button
              onClick={handleExportExcel}
              disabled={!excelUrl}
              className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
              Excel (.xlsx)
            </button>
            <button
              onClick={handleExportCsv}
              className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <FileText className="h-4 w-4 mr-2 text-blue-600" />
              CSV (.csv)
            </button>
          </div>
        </>
      )}
    </div>
  )
}
