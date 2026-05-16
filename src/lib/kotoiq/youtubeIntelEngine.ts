// ─────────────────────────────────────────────────────────────
// YouTube Intel Engine — Phase F
//
// Free YouTube Data API v3 (10K quota units/day). For each
// competitor brand we resolve to a channel, pull subscriber +
// view + video totals, and fetch the 50 most recent uploads
// with per-video stats.
//
// Auth: YOUTUBE_API_KEY env var.
// Docs: https://developers.google.com/youtube/v3/docs
// ─────────────────────────────────────────────────────────────

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

const API = 'https://www.googleapis.com/youtube/v3'
const TIMEOUT = 12_000
const RECENT_UPLOADS_LIMIT = 50

function key(): string {
  return process.env.YOUTUBE_API_KEY || process.env.YT_API_KEY || ''
}

async function fetchJson(url: string): Promise<any> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), TIMEOUT)
  try {
    const r = await fetch(url, { signal: ctl.signal })
    if (!r.ok) {
      const txt = await r.text().catch(() => '')
      throw new Error(`YouTube API HTTP ${r.status}: ${txt.slice(0, 200)}`)
    }
    return await r.json()
  } finally {
    clearTimeout(t)
  }
}

export interface YouTubeChannel {
  id: string
  title: string
  handle?: string
  description?: string
  thumbnail?: string
  custom_url?: string
  uploads_playlist_id?: string
  country?: string
  subscriber_count?: number
  view_count?: number
  video_count?: number
}

export interface YouTubeVideo {
  video_id: string
  channel_id: string
  title: string
  description: string
  thumbnail: string
  published_at: string
  duration_seconds: number
  view_count: number
  like_count: number
  comment_count: number
  is_short: boolean
}

// ─────────────────────────────────────────────────────────────
// 1. Find a channel by brand search
// ─────────────────────────────────────────────────────────────
export async function findYouTubeChannel(brand: string): Promise<{ candidates: YouTubeChannel[]; error?: string }> {
  if (!key()) return { candidates: [], error: 'YOUTUBE_API_KEY not set' }
  if (!brand?.trim()) return { candidates: [], error: 'brand required' }

  try {
    const url = `${API}/search?part=snippet&type=channel&maxResults=5&q=${encodeURIComponent(brand.trim())}&key=${key()}`
    const data = await fetchJson(url)
    const items = data?.items || []
    const candidates: YouTubeChannel[] = items.map((it: any) => ({
      id: it?.snippet?.channelId || it?.id?.channelId,
      title: it?.snippet?.channelTitle || it?.snippet?.title || '',
      description: it?.snippet?.description || '',
      thumbnail: it?.snippet?.thumbnails?.default?.url || it?.snippet?.thumbnails?.medium?.url || '',
    })).filter((c: YouTubeChannel) => c.id && c.title)
    return { candidates }
  } catch (e: any) {
    return { candidates: [], error: e?.message || String(e) }
  }
}

// ─────────────────────────────────────────────────────────────
// 2. Fetch full channel stats + uploads playlist ID
// ─────────────────────────────────────────────────────────────
export async function fetchChannelStats(channelId: string): Promise<{ channel: YouTubeChannel | null; error?: string }> {
  if (!key()) return { channel: null, error: 'YOUTUBE_API_KEY not set' }
  try {
    const url = `${API}/channels?part=snippet,statistics,contentDetails,brandingSettings&id=${channelId}&key=${key()}`
    const data = await fetchJson(url)
    const it = data?.items?.[0]
    if (!it) return { channel: null }
    const channel: YouTubeChannel = {
      id: it.id,
      title: it.snippet?.title,
      handle: it.snippet?.customUrl,
      description: it.snippet?.description,
      thumbnail: it.snippet?.thumbnails?.high?.url || it.snippet?.thumbnails?.medium?.url,
      custom_url: it.snippet?.customUrl,
      country: it.snippet?.country,
      uploads_playlist_id: it.contentDetails?.relatedPlaylists?.uploads,
      subscriber_count: Number(it.statistics?.subscriberCount || 0),
      view_count: Number(it.statistics?.viewCount || 0),
      video_count: Number(it.statistics?.videoCount || 0),
    }
    return { channel }
  } catch (e: any) {
    return { channel: null, error: e?.message || String(e) }
  }
}

// ─────────────────────────────────────────────────────────────
// 3. Recent uploads — playlistItems → videos
// ─────────────────────────────────────────────────────────────
export async function fetchRecentUploads(channelId: string, uploadsPlaylistId: string, limit = RECENT_UPLOADS_LIMIT): Promise<{ videos: YouTubeVideo[]; error?: string }> {
  if (!key()) return { videos: [], error: 'YOUTUBE_API_KEY not set' }
  if (!uploadsPlaylistId) return { videos: [], error: 'uploads playlist missing' }

  try {
    // Step 1: playlistItems for video IDs
    const playUrl = `${API}/playlistItems?part=contentDetails,snippet&playlistId=${uploadsPlaylistId}&maxResults=${Math.min(limit, 50)}&key=${key()}`
    const playData = await fetchJson(playUrl)
    const items = playData?.items || []
    const videoIds = items.map((it: any) => it?.contentDetails?.videoId).filter(Boolean).slice(0, 50)
    if (!videoIds.length) return { videos: [] }

    // Step 2: video stats for those IDs
    const vidUrl = `${API}/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}&key=${key()}`
    const vidData = await fetchJson(vidUrl)
    const videos: YouTubeVideo[] = (vidData?.items || []).map((v: any) => {
      const duration = parseIso8601Duration(v.contentDetails?.duration)
      return {
        video_id: v.id,
        channel_id: channelId,
        title: v.snippet?.title || '',
        description: (v.snippet?.description || '').slice(0, 1000),
        thumbnail: v.snippet?.thumbnails?.high?.url || v.snippet?.thumbnails?.medium?.url || '',
        published_at: v.snippet?.publishedAt || new Date().toISOString(),
        duration_seconds: duration,
        view_count: Number(v.statistics?.viewCount || 0),
        like_count: Number(v.statistics?.likeCount || 0),
        comment_count: Number(v.statistics?.commentCount || 0),
        is_short: duration > 0 && duration <= 60,
      }
    })
    return { videos }
  } catch (e: any) {
    return { videos: [], error: e?.message || String(e) }
  }
}

function parseIso8601Duration(d?: string): number {
  if (!d) return 0
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 0
  const h = parseInt(m[1] || '0', 10)
  const mi = parseInt(m[2] || '0', 10)
  const s = parseInt(m[3] || '0', 10)
  return h * 3600 + mi * 60 + s
}

// ─────────────────────────────────────────────────────────────
// 4. End-to-end sync for a brand
// ─────────────────────────────────────────────────────────────
export async function syncYouTubeForBrand(
  s: SupabaseClient,
  body: { client_id: string; brand: string; channel_id?: string },
): Promise<{ channel?: any; videos_synced: number; error?: string }> {
  const { client_id, brand, channel_id } = body
  if (!client_id || !brand) throw new Error('client_id and brand required')

  // Resolve channel ID if not provided
  let resolvedChannelId = channel_id
  if (!resolvedChannelId) {
    const { candidates, error } = await findYouTubeChannel(brand)
    if (error) return { videos_synced: 0, error }
    if (!candidates.length) return { videos_synced: 0, error: 'no channel found' }
    resolvedChannelId = candidates[0].id
  }

  // Channel stats
  const { channel, error: chErr } = await fetchChannelStats(resolvedChannelId)
  if (chErr || !channel) return { videos_synced: 0, error: chErr || 'channel not found' }

  // Persist channel
  await s.from('kotoiq_competitor_youtube_channels').upsert({
    client_id,
    brand_name: brand,
    channel_id: channel.id,
    channel_handle: channel.handle || null,
    channel_title: channel.title || null,
    channel_description: channel.description || null,
    thumbnail_url: channel.thumbnail || null,
    custom_url: channel.custom_url || null,
    uploads_playlist_id: channel.uploads_playlist_id || null,
    country: channel.country || null,
    subscriber_count: channel.subscriber_count || null,
    view_count: channel.view_count || null,
    video_count: channel.video_count || null,
    last_synced_at: new Date().toISOString(),
  }, { onConflict: 'client_id,channel_id' })

  // Recent videos
  const { videos, error: vidErr } = await fetchRecentUploads(channel.id, channel.uploads_playlist_id || '')
  if (vidErr) return { channel, videos_synced: 0, error: vidErr }

  // Persist videos
  if (videos.length) {
    const rows = videos.map(v => ({
      client_id,
      channel_id: v.channel_id,
      video_id: v.video_id,
      title: v.title,
      description: v.description,
      thumbnail_url: v.thumbnail,
      published_at: v.published_at,
      duration_seconds: v.duration_seconds,
      view_count: v.view_count,
      like_count: v.like_count,
      comment_count: v.comment_count,
      is_short: v.is_short,
      fetched_at: new Date().toISOString(),
    }))
    await s.from('kotoiq_competitor_youtube_videos').upsert(rows, { onConflict: 'client_id,video_id' })
  }

  return { channel, videos_synced: videos.length }
}

// ─────────────────────────────────────────────────────────────
// 5. Read APIs
// ─────────────────────────────────────────────────────────────
export async function listYouTubeChannels(s: SupabaseClient, body: { client_id: string }) {
  if (!body.client_id) throw new Error('client_id required')
  const { data, error } = await s.from('kotoiq_competitor_youtube_channels')
    .select('*')
    .eq('client_id', body.client_id)
    .order('subscriber_count', { ascending: false })
  if (error) throw new Error(error.message)
  return { channels: data || [] }
}

export async function listYouTubeVideos(s: SupabaseClient, body: { client_id: string; channel_id?: string; limit?: number; days?: number }) {
  const { client_id, channel_id, limit = 50, days } = body
  if (!client_id) throw new Error('client_id required')
  let q = s.from('kotoiq_competitor_youtube_videos')
    .select('*')
    .eq('client_id', client_id)
    .order('published_at', { ascending: false })
    .limit(limit)
  if (channel_id) q = q.eq('channel_id', channel_id)
  if (days) q = q.gte('published_at', new Date(Date.now() - days * 86400000).toISOString())
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return { videos: data || [] }
}
