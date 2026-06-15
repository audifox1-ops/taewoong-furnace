import { Download } from 'lucide-react'

interface ExportButtonProps {
  headers: string[]
  rows: (string | number | null | undefined)[][]
  filename: string
  label?: string
}

export function ExportButton({ headers, rows, filename, label = '엑셀 내보내기' }: ExportButtonProps) {
  const handleExport = () => {
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
  }

  return (
    <button 
      onClick={handleExport}
      className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
      aria-label={`${label} - ${filename}`}
    >
      <Download className="h-4 w-4 mr-1" />
      {label}
    </button>
  )
}
