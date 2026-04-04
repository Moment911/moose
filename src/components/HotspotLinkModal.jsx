import { useState } from 'react'
import { X, Link, FileImage, FileText, Globe } from 'lucide-react'

function FileIcon({ type }) {
  if (type?.startsWith('image/')) return <FileImage size={14} className="text-blue-500" />
  if (type === 'application/pdf') return <FileText size={14} className="text-red-500" />
  return <Globe size={14} className="text-green-500" />
}

export default function HotspotLinkModal({ files, currentFileId, onSave, onCancel }) {
  const [selectedFileId, setSelectedFileId] = useState('')
  const [label, setLabel] = useState('')

  const otherFiles = files.filter(f => f.id !== currentFileId)

  function handleSave() {
    if (!selectedFileId) return
    const target = files.find(f => f.id === selectedFileId)
    onSave({ targetFileId: selectedFileId, targetFileName: target?.name, label })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Link size={15} className="text-brand-500" />
            <h2 className="font-semibold text-gray-900 text-sm">Link Hotspot to Page</h2>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Button label <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="e.g. Services button, Nav link…"
              value={label}
              onChange={e => setLabel(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Links to
            </label>
            {otherFiles.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-xl">
                <FileImage size={24} className="text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-500">No other files in this project.</p>
                <p className="text-xs text-gray-400 mt-1">Upload more files first.</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {otherFiles.map(file => (
                  <div
                    key={file.id}
                    onClick={() => setSelectedFileId(file.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedFileId === file.id
                        ? 'border-brand-400 bg-brand-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center border border-gray-200">
                      {file.type?.startsWith('image/') ? (
                        <img src={file.url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <FileIcon type={file.type} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                      <p className="text-xs text-gray-400">
                        {file.type?.startsWith('image/') ? 'Image' : file.type === 'application/pdf' ? 'PDF' : 'HTML'}
                      </p>
                    </div>
                    {selectedFileId === file.id && (
                      <div className="w-4 h-4 rounded-full bg-brand-500 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedFileId}
            className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed font-medium flex items-center gap-2"
          >
            <Link size={13} />
            Create link
          </button>
        </div>
      </div>
    </div>
  )
}
