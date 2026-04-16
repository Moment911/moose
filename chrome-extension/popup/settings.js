// KotoIQ Settings page logic

const DEFAULT_ENDPOINT = 'https://hellokoto.com/api/kotoiq'

const endpointEl = document.getElementById('endpoint')
const apiKeyEl = document.getElementById('api_key')
const agencyIdEl = document.getElementById('agency_id')
const defaultClientEl = document.getElementById('default_client')
const saveBtn = document.getElementById('save')
const refreshBtn = document.getElementById('refresh-clients')
const saveStatus = document.getElementById('save-status')

let settings = { endpoint: DEFAULT_ENDPOINT, api_key: '', agency_id: '', default_client_id: '' }

function escape(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function callApi(action, body) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      type: 'kotoiq_api',
      endpoint: endpointEl.value || DEFAULT_ENDPOINT,
      api_key: apiKeyEl.value || '',
      body: { action, ...body },
    }, (resp) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message))
      if (!resp) return reject(new Error('No response from background'))
      if (resp.error) return reject(new Error(resp.error))
      resolve(resp.data)
    })
  })
}

async function loadClients() {
  const agencyId = agencyIdEl.value.trim()
  if (!agencyId) {
    defaultClientEl.innerHTML = '<option value="">— Set Agency ID first —</option>'
    return
  }
  defaultClientEl.innerHTML = '<option value="">Loading…</option>'
  try {
    const res = await callApi('list_clients_for_extension', { agency_id: agencyId })
    const clients = res.clients || []
    defaultClientEl.innerHTML = '<option value="">— None —</option>' +
      clients.map(c => `<option value="${c.id}">${escape(c.name)}</option>`).join('')
    if (settings.default_client_id) defaultClientEl.value = settings.default_client_id
  } catch (e) {
    defaultClientEl.innerHTML = `<option value="">Error: ${escape(e.message)}</option>`
  }
}

function load() {
  chrome.storage.local.get(['kotoiq_settings'], (r) => {
    settings = { ...settings, ...(r.kotoiq_settings || {}) }
    endpointEl.value = settings.endpoint || DEFAULT_ENDPOINT
    apiKeyEl.value = settings.api_key || ''
    agencyIdEl.value = settings.agency_id || ''
    loadClients()
  })
}

function save() {
  const newSettings = {
    endpoint: endpointEl.value.trim() || DEFAULT_ENDPOINT,
    api_key: apiKeyEl.value.trim(),
    agency_id: agencyIdEl.value.trim(),
    default_client_id: defaultClientEl.value || '',
  }
  chrome.storage.local.set({ kotoiq_settings: newSettings }, () => {
    settings = newSettings
    saveStatus.textContent = 'Saved.'
    saveStatus.style.color = 'var(--k-green)'
    setTimeout(() => { saveStatus.textContent = '' }, 2500)
  })
}

saveBtn.addEventListener('click', save)
refreshBtn.addEventListener('click', loadClients)

load()
