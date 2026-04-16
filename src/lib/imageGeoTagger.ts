// ─────────────────────────────────────────────────────────────
// Image Geo-Tagger — writes EXIF GPS + IPTC metadata to JPEGs
// Based on SemanticsX image-geo-tagger methodology
// ─────────────────────────────────────────────────────────────

// @ts-ignore - piexifjs has no type defs
import piexif from 'piexifjs'

// Convert decimal degrees to degrees/minutes/seconds tuple format for EXIF
function decimalToDMS(decimal: number): [[number, number], [number, number], [number, number]] {
  const absolute = Math.abs(decimal)
  const degrees = Math.floor(absolute)
  const minutesFloat = (absolute - degrees) * 60
  const minutes = Math.floor(minutesFloat)
  const seconds = Math.round((minutesFloat - minutes) * 60 * 100)
  return [[degrees, 1], [minutes, 1], [seconds, 100]]
}

// Geocode an address → { lat, lng }
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; city?: string; state?: string; country?: string } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_PLACES_KEY || process.env.GOOGLE_API_KEY
  if (!apiKey || !address) return null
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    const data = await res.json()
    const result = data.results?.[0]
    if (!result) return null
    const components = result.address_components || []
    const getComponent = (type: string) => components.find((c: any) => c.types?.includes(type))?.long_name
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      city: getComponent('locality') || getComponent('sublocality'),
      state: getComponent('administrative_area_level_1'),
      country: getComponent('country'),
    }
  } catch {
    return null
  }
}

// Format date for EXIF (YYYY:MM:DD HH:MM:SS)
function formatExifDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}:${p(d.getMonth() + 1)}:${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export interface GeoTagParams {
  imageBase64: string          // data URL (data:image/jpeg;base64,...) or raw base64 JPEG
  businessName: string
  address?: string
  lat?: number
  lng?: number
  city?: string
  state?: string
  country?: string
  keywords?: string[]
  caption?: string
  takenAt?: Date
  cameraMake?: string
  cameraModel?: string
  altitude?: number            // meters above sea level, default 10
}

export interface GeoTagResult {
  taggedImageBase64: string    // data URL
  metadata: {
    gps: { lat: number; lng: number; altitude: number }
    location: { address?: string; city?: string; state?: string; country?: string }
    dateTime: string
    camera: { make: string; model: string }
    software: string
    copyright: string
    caption?: string
    keywords?: string[]
  }
}

export async function geoTagImage(params: GeoTagParams): Promise<GeoTagResult> {
  let lat = params.lat
  let lng = params.lng
  let city = params.city
  let state = params.state
  let country = params.country

  // Geocode if we only have an address
  if ((lat === undefined || lng === undefined) && params.address) {
    const geo = await geocodeAddress(params.address)
    if (geo) {
      lat = geo.lat
      lng = geo.lng
      city = city || geo.city
      state = state || geo.state
      country = country || geo.country
    }
  }

  if (lat === undefined || lng === undefined) {
    throw new Error('Cannot geo-tag: no GPS coordinates or resolvable address provided')
  }

  // Ensure we have a proper data URL
  let dataUrl = params.imageBase64
  if (!dataUrl.startsWith('data:')) {
    dataUrl = `data:image/jpeg;base64,${dataUrl}`
  }

  // piexifjs only supports JPEG
  if (!dataUrl.startsWith('data:image/jpeg') && !dataUrl.startsWith('data:image/jpg')) {
    throw new Error('Geo-tagging only supports JPEG images. Convert PNG/WebP to JPEG first.')
  }

  const taken = params.takenAt || new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000)
  const exifDate = formatExifDate(taken)
  const gpsDate = `${taken.getFullYear()}:${String(taken.getMonth() + 1).padStart(2, '0')}:${String(taken.getDate()).padStart(2, '0')}`

  const cameraMake = params.cameraMake || 'Apple'
  const cameraModel = params.cameraModel || 'iPhone 15 Pro'
  const altitude = params.altitude ?? 10

  const latRef = lat >= 0 ? 'N' : 'S'
  const lngRef = lng >= 0 ? 'E' : 'W'

  // Build EXIF dictionary
  const zeroth: any = {}
  const exif: any = {}
  const gps: any = {}

  // 0th IFD — basic image info
  zeroth[piexif.ImageIFD.Make] = cameraMake
  zeroth[piexif.ImageIFD.Model] = cameraModel
  zeroth[piexif.ImageIFD.Software] = 'KotoIQ Geo-Tagger'
  zeroth[piexif.ImageIFD.DateTime] = exifDate
  zeroth[piexif.ImageIFD.Artist] = params.businessName
  zeroth[piexif.ImageIFD.Copyright] = `© ${new Date().getFullYear()} ${params.businessName}`
  if (params.caption) zeroth[piexif.ImageIFD.ImageDescription] = params.caption

  // Exif IFD — capture details
  exif[piexif.ExifIFD.DateTimeOriginal] = exifDate
  exif[piexif.ExifIFD.DateTimeDigitized] = exifDate
  exif[piexif.ExifIFD.LensMake] = cameraMake
  exif[piexif.ExifIFD.LensModel] = `${cameraModel} back camera`
  if (params.caption) exif[piexif.ExifIFD.UserComment] = 'ASCII\x00\x00\x00' + params.caption

  // GPS IFD — the actual geo-tagging
  gps[piexif.GPSIFD.GPSVersionID] = [2, 3, 0, 0]
  gps[piexif.GPSIFD.GPSLatitudeRef] = latRef
  gps[piexif.GPSIFD.GPSLatitude] = decimalToDMS(lat)
  gps[piexif.GPSIFD.GPSLongitudeRef] = lngRef
  gps[piexif.GPSIFD.GPSLongitude] = decimalToDMS(lng)
  gps[piexif.GPSIFD.GPSAltitudeRef] = altitude >= 0 ? 0 : 1
  gps[piexif.GPSIFD.GPSAltitude] = [Math.abs(Math.round(altitude * 100)), 100]
  gps[piexif.GPSIFD.GPSDateStamp] = gpsDate
  gps[piexif.GPSIFD.GPSTimeStamp] = [
    [taken.getUTCHours(), 1],
    [taken.getUTCMinutes(), 1],
    [taken.getUTCSeconds(), 1],
  ]
  gps[piexif.GPSIFD.GPSMapDatum] = 'WGS-84'
  gps[piexif.GPSIFD.GPSProcessingMethod] = 'ASCII\x00\x00\x00GPS'

  const exifObj = { '0th': zeroth, Exif: exif, GPS: gps, Interop: {}, '1st': {}, thumbnail: null }
  const exifBytes = piexif.dump(exifObj)
  const taggedDataUrl = piexif.insert(exifBytes, dataUrl)

  return {
    taggedImageBase64: taggedDataUrl,
    metadata: {
      gps: { lat, lng, altitude },
      location: { address: params.address, city, state, country },
      dateTime: exifDate,
      camera: { make: cameraMake, model: cameraModel },
      software: 'KotoIQ Geo-Tagger',
      copyright: `© ${new Date().getFullYear()} ${params.businessName}`,
      caption: params.caption,
      keywords: params.keywords,
    },
  }
}
