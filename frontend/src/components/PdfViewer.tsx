import { useState, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw } from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface PdfViewerProps {
  url: string
  onClose?: () => void
}

export function PdfViewer({ url, onClose }: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [rotation, setRotation] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function onDocumentLoadSuccess({ numPages: n }: { numPages: number }) {
    setNumPages(n)
    setLoading(false)
  }

  function onDocumentLoadError(err: Error) {
    setError(err.message)
    setLoading(false)
  }

  const goPrev = () => setPageNumber(p => Math.max(1, p - 1))
  const goNext = () => setPageNumber(p => Math.min(numPages, p + 1))
  const zoomIn = () => setScale(s => Math.min(3, s + 0.2))
  const zoomOut = () => setScale(s => Math.max(0.4, s - 0.2))
  const rotate = () => setRotation(r => (r + 90) % 360)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
      else if (e.key === '+' || e.key === '=') zoomIn()
      else if (e.key === '-') zoomOut()
      else if (e.key === 'r') rotate()
      else if (e.key === 'Escape' && onClose) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [numPages, onClose])

  return (
    <div className="flex flex-col h-full bg-gray-800 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-700 text-white">
        <div className="flex items-center gap-2">
          <button onClick={goPrev} disabled={pageNumber <= 1}
            className="p-1 hover:bg-gray-600 rounded disabled:opacity-30">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-sm">
            {pageNumber} / {numPages}
          </span>
          <button onClick={goNext} disabled={pageNumber >= numPages}
            className="p-1 hover:bg-gray-600 rounded disabled:opacity-30">
            <ChevronRight className="h-5 w-5" />
          </button>
          <span className="mx-2 text-gray-400">|</span>
          <button onClick={zoomOut} className="p-1 hover:bg-gray-600 rounded">
            <ZoomOut className="h-5 w-5" />
          </button>
          <span className="text-sm">{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} className="p-1 hover:bg-gray-600 rounded">
            <ZoomIn className="h-5 w-5" />
          </button>
          <button onClick={rotate} className="p-1 hover:bg-gray-600 rounded">
            <RotateCw className="h-5 w-5" />
          </button>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">
            닫기
          </button>
        )}
      </div>
      <div className="flex-1 overflow-auto flex justify-center p-4">
        {loading && (
          <div className="flex items-center justify-center text-white">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mr-2"></div>
            로딩 중...
          </div>
        )}
        {error && (
          <div className="text-red-400 text-sm">PDF를 불러올 수 없습니다: {error}</div>
        )}
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading=""
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            rotate={rotation}
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>
    </div>
  )
}
