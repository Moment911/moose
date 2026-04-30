"use client"
import { useState, useEffect, useRef } from 'react'
import {
  Image as ImageIcon, Upload, Sparkles, Loader2, MapPin, Calendar, Camera,
  Copyright, Download, Copy, CheckCircle, UploadCloud,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { R, T, BLK, GRN, AMB, FH } from '../../lib/theme'
import HowItWorks from './HowItWorks'

const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 14 }

async function pngToJpeg(dataUrl, quality = 0.95) {
  const img = new window.Image()
  img.src = dataUrl
  await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject })
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0)
  return canvas.toDataURL('image/jpeg', quality)
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function GMBImagesTab({ clientId, agencyId, prefilledForm }) {
  // Upload side
  const [uploadDataUrl, setUploadDataUrl] = useState(null)
  const [uploadKeywords, setUploadKeywords] = useState('')
  const [uploadCaption, setUploadCaption] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  // Conversational bot prefill
  useEffect(() => {
    if (!prefilledForm) return
    if (prefilledForm.location) setUploadKeywords(k => k || prefilledForm.location)
    if (prefilledForm.image_url) setUploadDataUrl(prefilledForm.image_url)
  }, [prefilledForm])

  // Generate side
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('photo')
  const [autoTag, setAutoTag] = useState(true)
  const [autoUpload, setAutoUpload] = useState(false)
  const [gbpCategory, setGbpCategory] = useState('ADDITIONAL')
  const [generating, setGenerating] = useState(false)

  // Preview + list
  const [preview, setPreview] = useState(null) // { dataUrl, metadata, saved }
  const [images, setImages] = useState([])

  const loadImages = async () => {
    if (!clientId) return
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list_gmb_images', client_id: clientId }),
      })
      const j = await res.json()
      setImages(j.images || [])
    } catch {}
  }

  useEffect(() => { loadImages() }, [clientId])

  const handleFile = async (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('File must be an image')
    const dataUrl = await fileToDataUrl(file)
    // If it's a PNG, convert to JPEG client-side before tagging
    const jpegUrl = file.type === 'image/png' ? await pngToJpeg(dataUrl) : dataUrl
    setUploadDataUrl(jpegUrl)
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) await handleFile(file)
  }

  const doGeoTag = async () => {
    if (!uploadDataUrl) return toast.error('Drop or select an image first')
    setUploading(true)
    try {
      const keywords = uploadKeywords.split(',').map(k => k.trim()).filter(Boolean)
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'geo_tag_image',
          client_id: clientId,
          image_base64: uploadDataUrl,
          keywords,
          caption: uploadCaption,
        }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      setPreview({ dataUrl: j.tagged_data_url, metadata: j.metadata, saved: j.image })
      toast.success('Image geo-tagged')
      await loadImages()
    } catch (e) {
      toast.error(e.message || 'Tagging failed')
    } finally {
      setUploading(false)
    }
  }

  const doGenerate = async () => {
    if (!prompt.trim()) return toast.error('Describe the image you want')
    setGenerating(true)
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_gmb_image',
          client_id: clientId,
          agency_id: agencyId,
          prompt,
          style,
          gbp_category: gbpCategory,
        }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)

      let finalDataUrl = j.image_base64 // PNG from OpenAI
      if (finalDataUrl && !finalDataUrl.startsWith('data:')) {
        finalDataUrl = `data:image/png;base64,${finalDataUrl}`
      }

      let metadata = null
      let saved = j.image

      // Convert PNG → JPEG client-side (required for EXIF)
      if (autoTag && finalDataUrl) {
        const jpegUrl = await pngToJpeg(finalDataUrl)
        const tagRes = await fetch('/api/kotoiq', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'geo_tag_image',
            client_id: clientId,
            image_base64: jpegUrl,
            keywords: (j.keywords || []),
            caption: j.caption || '',
          }),
        })
        const tagJ = await tagRes.json()
        if (!tagJ.error) {
          finalDataUrl = tagJ.tagged_data_url
          metadata = tagJ.metadata
          saved = tagJ.image
        }
      }

      if (autoUpload && saved?.id) {
        const upRes = await fetch('/api/kotoiq', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'upload_image_to_gbp',
            client_id: clientId,
            image_id: saved.id,
            category: gbpCategory,
          }),
        })
        const upJ = await upRes.json()
        if (upJ.error) toast.error('GBP upload: ' + upJ.error)
        else toast.success('Uploaded to Google Business Profile')
      }

      setPreview({ dataUrl: finalDataUrl, metadata, saved, caption: j.caption })
      toast.success('Image generated')
      await loadImages()
    } catch (e) {
      toast.error(e.message || 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const pushToGBP = async (imgId) => {
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upload_image_to_gbp', client_id: clientId, image_id: imgId, category: gbpCategory }),
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      toast.success('Uploaded to GBP')
      await loadImages()
    } catch (e) { toast.error(e.message) }
  }

  const downloadImage = (dataUrl, name = 'gmb-image.jpg') => {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = name
    a.click()
  }

  const copyJson = (obj) => {
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2))
    toast.success('Metadata copied')
  }

  return (
    <div>
      <HowItWorks tool="gmb_images" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        {/* LEFT — Upload */}
        <div style={card}>
          <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Upload size={16} color={T} /> Upload Image
          </div>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? T : '#d1d5db'}`, borderRadius: 10, padding: 30,
              textAlign: 'center', cursor: 'pointer', background: dragOver ? '#f9f9fb' : '#fafafb',
              marginBottom: 10, transition: 'all .15s',
            }}
          >
            {uploadDataUrl ? (
              <img src={uploadDataUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 6 }} />
            ) : (
              <>
                <ImageIcon size={32} color="#9ca3af" style={{ marginBottom: 6 }} />
                <div style={{ fontSize: 13, fontWeight: 700, color: BLK }}>Drop image here or click to browse</div>
                <div style={{ fontSize: 11, color: '#1f1f22', marginTop: 4 }}>PNG auto-converted to JPEG for EXIF</div>
              </>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={e => handleFile(e.target.files?.[0])} style={{ display: 'none' }} />
          </div>
          <input value={uploadKeywords} onChange={e => setUploadKeywords(e.target.value)} placeholder="Keywords (comma-separated)" style={{
            width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, fontFamily: FH, marginBottom: 8, boxSizing: 'border-box',
          }} />
          <input value={uploadCaption} onChange={e => setUploadCaption(e.target.value)} placeholder="Caption" style={{
            width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, fontFamily: FH, marginBottom: 10, boxSizing: 'border-box',
          }} />
          <button onClick={doGeoTag} disabled={uploading || !uploadDataUrl} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 8,
            border: 'none', background: T, color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: FH,
            cursor: uploading || !uploadDataUrl ? 'not-allowed' : 'pointer', opacity: (uploading || !uploadDataUrl) ? 0.6 : 1,
          }}>
            {uploading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <MapPin size={14} />}
            {uploading ? 'Tagging...' : 'Geo-Tag'}
          </button>
        </div>

        {/* RIGHT — Generate */}
        <div style={card}>
          <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={16} color={R} /> Generate with AI
          </div>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Describe the image (e.g. friendly dentist office interior with natural light)" rows={4} style={{
            width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, fontFamily: FH,
            resize: 'vertical', marginBottom: 8, boxSizing: 'border-box',
          }} />
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <select value={style} onChange={e => setStyle(e.target.value)} style={{
              flex: 1, padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, fontFamily: FH,
            }}>
              <option value="photo">Photo</option>
              <option value="illustration">Illustration</option>
              <option value="flat">Flat</option>
            </select>
            <select value={gbpCategory} onChange={e => setGbpCategory(e.target.value)} style={{
              flex: 1, padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, fontFamily: FH,
            }}>
              <option value="ADDITIONAL">Additional</option>
              <option value="EXTERIOR">Exterior</option>
              <option value="INTERIOR">Interior</option>
              <option value="PRODUCT">Product</option>
              <option value="AT_WORK">At Work</option>
              <option value="FOOD_AND_DRINK">Food &amp; Drink</option>
              <option value="MENU">Menu</option>
              <option value="COMMON_AREA">Common Area</option>
              <option value="TEAMS">Teams</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: BLK, cursor: 'pointer' }}>
              <input type="checkbox" checked={autoTag} onChange={e => setAutoTag(e.target.checked)} />
              Auto geo-tag (PNG → JPEG + EXIF)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: BLK, cursor: 'pointer' }}>
              <input type="checkbox" checked={autoUpload} onChange={e => setAutoUpload(e.target.checked)} />
              Auto upload to GBP
            </label>
          </div>
          <button onClick={doGenerate} disabled={generating} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 8,
            border: 'none', background: R, color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: FH,
            cursor: generating ? 'wait' : 'pointer', opacity: generating ? 0.6 : 1,
          }}>
            {generating ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
            {generating ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>

      {/* Preview */}
      {preview && (
        <div style={card}>
          <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12 }}>Preview</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <img src={preview.dataUrl} alt="Generated" style={{ width: '100%', borderRadius: 10, border: '1px solid #e5e7eb' }} />
            </div>
            <div>
              {preview.metadata && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <MetaRow icon={MapPin} label="GPS" value={`${preview.metadata.gps?.lat?.toFixed(5)}, ${preview.metadata.gps?.lng?.toFixed(5)}`} />
                  <MetaRow icon={MapPin} label="Address" value={preview.metadata.location?.address || '—'} />
                  <MetaRow icon={Calendar} label="Date" value={preview.metadata.dateTaken || new Date().toLocaleDateString()} />
                  <MetaRow icon={Camera} label="Camera" value={preview.metadata.camera || 'Embedded EXIF'} />
                  <MetaRow icon={Copyright} label="Copyright" value={preview.metadata.copyright || '—'} />
                </div>
              )}
              {preview.caption && (
                <div style={{ marginTop: 12, padding: 10, background: '#f9f9fb', borderRadius: 8, fontSize: 12, color: '#1f1f22' }}>
                  <div style={{ fontWeight: 700, marginBottom: 4, color: '#1f1f22', fontSize: 11, textTransform: 'uppercase' }}>Caption</div>
                  {preview.caption}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button onClick={() => downloadImage(preview.dataUrl)} style={btn('#fff', BLK)}>
                  <Download size={12} /> Download
                </button>
                {preview.saved?.id && (
                  <button onClick={() => pushToGBP(preview.saved.id)} style={btn(GRN, '#fff')}>
                    <UploadCloud size={12} /> Upload to GBP
                  </button>
                )}
                {preview.metadata && (
                  <button onClick={() => copyJson(preview.metadata)} style={btn('#fff', BLK)}>
                    <Copy size={12} /> Copy JSON
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent uploads */}
      {images.length > 0 && (
        <div style={card}>
          <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: BLK, marginBottom: 12 }}>Recent Uploads</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '8px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Image</th>
                  <th style={{ textAlign: 'left', padding: '8px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Caption</th>
                  <th style={{ textAlign: 'center', padding: '8px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Source</th>
                  <th style={{ textAlign: 'center', padding: '8px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>GBP</th>
                  <th style={{ textAlign: 'right', padding: '8px', fontSize: 11, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {images.slice(0, 20).map(img => (
                  <tr key={img.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px' }}>
                      {img.public_url && <img src={img.public_url} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }} />}
                    </td>
                    <td style={{ padding: '8px', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', color: '#1f2937' }}>{img.caption || '—'}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: img.source === 'generated' ? '#f1f1f6' : '#f1f1f6', color: img.source === 'generated' ? R : T }}>
                        {img.source}
                      </span>
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      {img.gbp_uploaded_at ? <CheckCircle size={14} color={GRN} /> : <span style={{ color: '#1f1f22', fontSize: 11 }}>—</span>}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>
                      {img.public_url && <button onClick={() => downloadImage(img.public_url, `gmb-${img.id}.jpg`)} style={{ ...btn('#fff', BLK), padding: '4px 10px' }}>
                        <Download size={11} />
                      </button>}
                      {!img.gbp_uploaded_at && img.public_url && <button onClick={() => pushToGBP(img.id)} style={{ ...btn(GRN, '#fff'), padding: '4px 10px', marginLeft: 4 }}>
                        <UploadCloud size={11} />
                      </button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function MetaRow({ icon: Icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 28, height: 28, borderRadius: 6, background: '#f1f1f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={13} color="#6b7280" />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#1f1f22', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
        <div style={{ fontSize: 12, color: BLK }}>{value}</div>
      </div>
    </div>
  )
}

function btn(bg, color) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 4, padding: '7px 12px', borderRadius: 6,
    border: '1px solid #e5e7eb', background: bg, fontSize: 11, fontWeight: 700, color, cursor: 'pointer',
  }
}
