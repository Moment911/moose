// KotoIQ SEO Intel — background service worker (Manifest V3)
// Handles API requests on behalf of the popup to avoid CORS issues and keep
// the API key out of content scripts.

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['kotoiq_settings'], (r) => {
    if (!r.kotoiq_settings) {
      chrome.storage.local.set({
        kotoiq_settings: {
          endpoint: 'https://hellokoto.com/api/kotoiq',
          api_key: '',
          agency_id: '',
          default_client_id: '',
        },
      })
    }
  })
})

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'kotoiq_api') {
    handleApiCall(msg).then(sendResponse).catch((e) => sendResponse({ error: e.message || String(e) }))
    return true // keep channel open
  }

  if (msg?.type === 'kotoiq_get_settings') {
    chrome.storage.local.get(['kotoiq_settings'], (r) => sendResponse(r.kotoiq_settings || {}))
    return true
  }

  if (msg?.type === 'kotoiq_set_settings') {
    chrome.storage.local.set({ kotoiq_settings: msg.settings }, () => sendResponse({ ok: true }))
    return true
  }

  return false
})

async function handleApiCall({ endpoint, api_key, body }) {
  if (!endpoint) return { error: 'No endpoint configured' }
  const url = endpoint

  try {
    const headers = {
      'Content-Type': 'application/json',
    }
    if (api_key) headers['Authorization'] = `Bearer ${api_key}`

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body || {}),
    })
    const text = await res.text()
    let data
    try { data = JSON.parse(text) } catch { data = { raw: text } }
    if (!res.ok) return { error: data.error || `HTTP ${res.status}`, data }
    return { data }
  } catch (e) {
    return { error: e.message || 'Network error' }
  }
}
