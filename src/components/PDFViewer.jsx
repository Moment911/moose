"use client";
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'

export default function PDFViewer({ url, onDimensionsChange }) {
  const canvasRef = useRef(null)
  const [pdf, setPdf] = useState(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [scale, setScale] = useState(1.2)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        // Dynamically import pdfjs
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
        const doc = await pdfjsLib.getDocument(url).promise
        if (!cancelled) {
          setPdf(doc)
          setTotalPages(doc.numPages)
        }
      } catch (e) {
        console.error('PDF load error:', e)
      }
    }
    load()
    return () => { cancelled = true }
  }, [url])

  useEffect(() => {
    if (!pdf || !canvasRef.current) return
    renderPage()
  }, [pdf, page, scale])

  async function renderPage() {
    setLoading(true)
    const pdfPage = await pdf.getPage(page)
    const viewport = pdfPage.getViewport({ scale })
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    canvas.width = viewport.width
    canvas.height = viewport.height
    await pdfPage.render({ canvasContext: ctx, viewport }).promise
    onDimensionsChange?.(viewport.width, viewport.height)
    setLoading(false)
  }

  return (
    <div className="flex flex-col items-center">
      {/* PDF controls */}
      <div className="flex items-center gap-3 mb-3 bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-sm">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="text-gray-500 hover:text-gray-900 disabled:opacity-30"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm text-gray-700 font-medium min-w-[80px] text-center">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          className="text-gray-500 hover:text-gray-900 disabled:opacity-30"
        >
          <ChevronRight size={16} />
        </button>
        <div className="w-px h-4 bg-gray-200" />
        <button
          onClick={() => setScale(s => Math.max(0.5, s - 0.2))}
          className="text-gray-500 hover:text-gray-900"
        >
          <ZoomOut size={15} />
        </button>
        <span className="text-sm text-gray-500 w-10 text-center">{Math.round(scale * 100)}%</span>
        <button
          onClick={() => setScale(s => Math.min(3, s + 0.2))}
          className="text-gray-500 hover:text-gray-900"
        >
          <ZoomIn size={15} />
        </button>
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <canvas ref={canvasRef} className="block" />
    </div>
  )
}
