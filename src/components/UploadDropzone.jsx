"use client";
import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, FileImage, FileText, Globe } from 'lucide-react'
import { uploadFile, createFile, logActivity } from '../lib/supabase'
import toast from 'react-hot-toast'
import { nanoid } from '../lib/nanoid'

const ACCEPTED = {
  // Images
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/heic': ['.heic'],
  'image/heif': ['.heif'],
  'image/svg+xml': ['.svg'],
  'image/tiff': ['.tiff', '.tif'],
  'image/bmp': ['.bmp'],
  'image/avif': ['.avif'],
  // Documents
  'application/pdf': ['.pdf'],
  // Web
  'text/html': ['.html', '.htm'],
  // Video
  'video/mp4': ['.mp4'],
  'video/quicktime': ['.mov'],
  'video/webm': ['.webm'],
  // Adobe
  'application/postscript': ['.ai', '.eps'],
  'image/vnd.adobe.photoshop': ['.psd'],
  'application/x-indesign': ['.indd'],
  'application/illustrator': ['.ai'],
  // Figma / Sketch / XD (exported)
  'application/x-sketch': ['.sketch'],
  // Archives
  'application/zip': ['.zip'],
  'application/x-zip-compressed': ['.zip'],
}

const EXTRACTABLE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'html', 'htm', 'mp4', 'mov', 'webm', 'svg', 'heic', 'avif', 'tiff', 'tif', 'bmp']

async function extractZip(zipFile) {
  const { BlobReader, BlobWriter, ZipReader } = await import('@zip.js/zip.js')
  const reader = new ZipReader(new BlobReader(zipFile))
  const entries = await reader.getEntries()
  const extracted = []
  for (const entry of entries) {
    if (entry.directory) continue
    const name = entry.filename.split('/').pop() || entry.filename
    const ext = name.split('.').pop()?.toLowerCase() || ''
    if (!EXTRACTABLE_EXTS.includes(ext)) continue
    if (name.startsWith('.') || name.startsWith('__MACOSX')) continue
    const blob = await entry.getData(new BlobWriter())
    const file = new File([blob], name, { type: normalizeType({ name, type: '' }) })
    Object.assign(file, { preview: URL.createObjectURL(file) })
    extracted.push(file)
  }
  await reader.close()
  return extracted
}

// Browsers sometimes hand us a File with an empty .type for HTML
// files because the OS doesn't always have a MIME mapping. Fall
// back to the extension so the preview path in FileReviewPage
// can switch on the right renderer.
function normalizeType(file) {
  if (file.type) return file.type
  const ext = file.name?.split('.').pop()?.toLowerCase()
  const map = {
    // Web
    html: 'text/html', htm: 'text/html',
    // Documents
    pdf: 'application/pdf',
    // Images
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
    heic: 'image/heic', heif: 'image/heif', avif: 'image/avif',
    tiff: 'image/tiff', tif: 'image/tiff', bmp: 'image/bmp',
    // Video
    mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
    // Adobe
    psd: 'image/vnd.adobe.photoshop', ai: 'application/illustrator',
    eps: 'application/postscript', indd: 'application/x-indesign',
    // Design
    sketch: 'application/x-sketch', xd: 'application/x-adobe-xd',
    fig: 'application/x-figma',
  }
  return map[ext || ''] || 'application/octet-stream'
}

function FileIcon({ type }) {
  if (type?.startsWith('image/')) return <FileImage size={20} className="text-blue-500" />
  if (type === 'application/pdf') return <FileText size={20} className="text-red-500" />
  return <Globe size={20} className="text-green-500" />
}

export default function UploadDropzone({ projectId, onUploaded }) {
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState({})

  const onDrop = useCallback(async (accepted) => {
    const newFiles = []
    for (const f of accepted) {
      if (f.name.toLowerCase().endsWith('.zip')) {
        toast.loading('Extracting ZIP...', { id: 'zip' })
        try {
          const extracted = await extractZip(f)
          newFiles.push(...extracted)
          toast.success(`Extracted ${extracted.length} files from ${f.name}`, { id: 'zip' })
        } catch (e) {
          toast.error('Failed to extract ZIP', { id: 'zip' })
          console.error(e)
        }
      } else {
        newFiles.push(Object.assign(f, { preview: URL.createObjectURL(f) }))
      }
    }
    setFiles(prev => [...prev, ...newFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: ACCEPTED, maxSize: 50 * 1024 * 1024,
    onDropRejected: () => toast.error('File too large or unsupported format (max 50MB)')
  })

  function removeFile(idx) {
    setFiles(f => f.filter((_, i) => i !== idx))
  }

  async function handleUpload() {
    if (!files.length) return
    setUploading(true)
    const uploaded = []

    for (const file of files) {
      try {
        setProgress(p => ({ ...p, [file.name]: 10 }))

        let url, path, fileType, fileName, fileSize

        // Handle website URL entries
        if (file.websiteUrl) {
          setProgress(p => ({ ...p, [file.name]: 30 }))
          fileName = file.websiteUrl.replace(/^https?:\/\//, '').replace(/[\/\?#].*/g, '')
          fileType = 'text/x-url'
          fileSize = 0
          url = file.websiteUrl
          path = ''
        } else {
          const ext = file.name.split('.').pop()
          path = `${projectId}/${nanoid()}.${ext}`
          url = await uploadFile(file, path)
          fileType = normalizeType(file)
          fileName = file.name
          fileSize = file.size
        }

        setProgress(p => ({ ...p, [file.name]: 70 }))

        const { data, error } = await createFile({
          project_id: projectId,
          name: fileName,
          url,
          storage_path: path,
          type: fileType,
          size: fileSize,
          public_token: nanoid(16),
          open_comments: 0,
          comment_count: 0,
        })
        if (error) throw error

        await logActivity({
          project_id: projectId,
          file_id: data.id,
          action: 'upload',
          detail: `Uploaded "${file.name}"`,
          actor: 'Admin',
        })

        setProgress(p => ({ ...p, [file.name]: 100 }))
        uploaded.push(data)
      } catch (err) {
        toast.error(`Failed to upload ${file.name}`)
        console.error(err)
      }
    }

    toast.success(`${uploaded.length} file${uploaded.length !== 1 ? 's' : ''} uploaded!`)
    setFiles([])
    setProgress({})
    setUploading(false)
    onUploaded(uploaded)
  }

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-brand-400 bg-brand-50' : 'border-gray-300 hover:border-brand-300 hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        <Upload size={32} className={`mx-auto mb-3 ${isDragActive ? 'text-brand-500' : 'text-gray-400'}`} />
        <p className="font-medium text-gray-700 text-sm mb-1">
          {isDragActive ? 'Drop your files here' : 'Drag & drop files here'}
        </p>
        <p className="text-sm text-gray-500">Images (PNG, JPG, HEIC, WebP, SVG, TIFF) · PDF · HTML · Video · Adobe (PSD, AI, EPS, INDD) · Figma/Sketch · ZIP · Up to 50MB</p>
        <button type="button" className="mt-3 btn-secondary text-sm py-1.5">Browse files</button>
      </div>

      {/* Website URL input */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Globe size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            id="proof-url-input"
            placeholder="Or paste a website URL to proof..."
            style={{ width: '100%', padding: '10px 12px 10px 34px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, color: '#111', outline: 'none' }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const url = e.target.value.trim()
                if (!url) return
                const fullUrl = url.startsWith('http') ? url : 'https://' + url
                // Create a virtual "file" entry for the URL
                const urlFile = new File([''], `website-${new Date().toISOString().slice(0,10)}.url`, { type: 'text/x-url' })
                Object.assign(urlFile, { preview: '', websiteUrl: fullUrl })
                setFiles(prev => [...prev, urlFile])
                e.target.value = ''
                toast.success('Website added — click Upload to capture')
              }
            }}
          />
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
              <FileIcon type={file.type} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                {progress[file.name] > 0 && (
                  <div className="mt-1.5 h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full transition-all duration-300"
                      style={{ width: `${progress[file.name]}%` }}
                    />
                  </div>
                )}
              </div>
              {!uploading && (
                <button onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500">
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="btn-primary w-full justify-center"
          >
            {uploading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Uploading…
              </>
            ) : `Upload ${files.length} file${files.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  )
}
