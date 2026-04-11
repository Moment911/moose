"use client";
import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, FileImage, FileText, Globe } from 'lucide-react'
import { uploadFile, createFile, logActivity } from '../lib/supabase'
import toast from 'react-hot-toast'
import { nanoid } from '../lib/nanoid'

const ACCEPTED = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
  'text/html': ['.html', '.htm'],
  'video/mp4': ['.mp4'],
  'video/quicktime': ['.mov'],
  'video/webm': ['.webm'],
}

// Browsers sometimes hand us a File with an empty .type for HTML
// files because the OS doesn't always have a MIME mapping. Fall
// back to the extension so the preview path in FileReviewPage
// can switch on the right renderer.
function normalizeType(file) {
  if (file.type) return file.type
  const ext = file.name?.split('.').pop()?.toLowerCase()
  const map = {
    html: 'text/html', htm: 'text/html',
    pdf: 'application/pdf',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp',
    mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
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

  const onDrop = useCallback(accepted => {
    setFiles(prev => [...prev, ...accepted.map(f => Object.assign(f, { preview: URL.createObjectURL(f) }))])
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
        const ext = file.name.split('.').pop()
        const path = `${projectId}/${nanoid()}.${ext}`
        const url = await uploadFile(file, path)
        setProgress(p => ({ ...p, [file.name]: 70 }))

        const { data, error } = await createFile({
          project_id: projectId,
          name: file.name,
          url,
          storage_path: path,
          type: normalizeType(file),
          size: file.size,
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
        <p className="text-sm text-gray-500">PNG, JPG, PDF, HTML · Up to 50MB each</p>
        <button type="button" className="mt-3 btn-secondary text-sm py-1.5">Browse files</button>
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
