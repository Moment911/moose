// KotoIQ SEO Intel — popup logic
// Uses vanilla JS, no build step.

const DEFAULT_ENDPOINT = 'https://hellokoto.com/api/kotoiq'

const statusDot = document.getElementById('status-dot')
const statusLabel = document.getElementById('status-label')
const pageUrlEl = document.getElementById('page-url')
const clientSelect = document.getElementById('client-select')
const resultsEl = document.getElementById('results')
const openSettingsLink = document.getElementById('open-settings')

let currentTabId = null
let currentTabUrl = ''
let settings = { endpoint: DEFAULT_ENDPOINT, api_key: '', agency_id: '', default_client_id: '' }

// ── Settings I/O ────────────────────────────────────────────────────
function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['kotoiq_settings'], (r) => {
      settings = { ...settings, ...(r.kotoiq_settings || {}) }
      if (!settings.endpoint) settings.endpoint = DEFAULT_ENDPOINT
      resolve(settings)
    })
  })
}

// ── Status ─────────────────────────────────────────────────────────
function updateStatus() {
  if (!settings.api_key) {
    statusDot.className = 'dot err'
    statusLabel.textContent = 'No API key'
  } else {
    statusDot.className = 'dot ok'
    statusLabel.textContent = 'Connected'
  }
}

// ── Populate clients ───────────────────────────────────────────────
async function loadClients() {
  if (!settings.agency_id) {
    clientSelect.innerHTML = '<option value="">Set agency ID in settings</option>'
    return
  }
  clientSelect.innerHTML = '<option value="">Loading&hellip;</option>'
  try {
    const res = await callApi('list_clients_for_extension', { agency_id: settings.agency_id })
    const clients = res.clients || []
    clientSelect.innerHTML = '<option value="">— No client —</option>' +
      clients.map(c => `<option value="${c.id}">${escape(c.name)}</option>`).join('')
    if (settings.default_client_id) clientSelect.value = settings.default_client_id
  } catch (e) {
    clientSelect.innerHTML = `<option value="">Error loading: ${escape(e.message)}</option>`
  }
}

function escape(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

// ── API helper via background worker (avoids CORS) ─────────────────
function callApi(action, body) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      type: 'kotoiq_api',
      endpoint: settings.endpoint,
      api_key: settings.api_key,
      body: { action, ...body },
    }, (resp) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message))
      if (!resp) return reject(new Error('No response'))
      if (resp.error) return reject(new Error(resp.error))
      resolve(resp.data)
    })
  })
}

// ── Content script — extract data from page ───────────────────────
function extractPageData() {
  return new Promise((resolve, reject) => {
    if (!currentTabId) return reject(new Error('No active tab'))
    chrome.tabs.sendMessage(currentTabId, { type: 'kotoiq_extract' }, (resp) => {
      if (chrome.runtime.lastError) {
        // Content script may not be injected yet — inject it manually
        chrome.scripting.executeScript({
          target: { tabId: currentTabId },
          files: ['content/content.js'],
        }, () => {
          chrome.tabs.sendMessage(currentTabId, { type: 'kotoiq_extract' }, (r2) => {
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message))
            resolve(r2 || {})
          })
        })
        return
      }
      resolve(resp || {})
    })
  })
}

// ── Renderers ──────────────────────────────────────────────────────
function renderLoading(label) {
  resultsEl.innerHTML = `<div class="loading"><div class="spinner"></div> Running ${escape(label)}&hellip;</div>`
}

function renderError(msg) {
  resultsEl.innerHTML = `<div class="error-card"><strong>Error:</strong> ${escape(msg)}</div>`
}

function scoreClass(n) {
  if (n >= 70) return 'good'
  if (n >= 40) return 'warn'
  return 'bad'
}

function renderOnPage(data) {
  const score = data.score ?? data.on_page_score ?? data.overall_score ?? null
  const issues = data.issues || data.problems || []
  const wins = data.wins || data.strengths || []

  let html = ''
  if (score !== null) {
    html += `<div class="result-card"><div class="result-title">On-Page Audit <span class="result-score ${scoreClass(score)}">${score}/100</span></div></div>`
  }
  if (data.word_count || data.title) {
    html += `<div class="result-card"><div class="result-title">Page Signals</div><div class="result-stats">`
    if (data.word_count) html += `<div class="stat"><div class="stat-label">Word count</div><div class="stat-value">${data.word_count}</div></div>`
    if (data.title) html += `<div class="stat"><div class="stat-label">Title len</div><div class="stat-value">${data.title.length}</div></div>`
    if (data.h1_count !== undefined) html += `<div class="stat"><div class="stat-label">H1s</div><div class="stat-value">${data.h1_count}</div></div>`
    if (data.h2_count !== undefined) html += `<div class="stat"><div class="stat-label">H2s</div><div class="stat-value">${data.h2_count}</div></div>`
    html += `</div></div>`
  }
  if (issues.length) {
    html += `<div class="result-card"><div class="result-title">Issues <span class="result-score bad">${issues.length}</span></div><ul class="list-compact">`
    issues.slice(0, 8).forEach(i => { html += `<li>${escape(typeof i === 'string' ? i : (i.message || i.title || JSON.stringify(i)))}</li>` })
    html += `</ul></div>`
  }
  if (wins.length) {
    html += `<div class="result-card"><div class="result-title">Strengths <span class="result-score good">${wins.length}</span></div><ul class="list-compact">`
    wins.slice(0, 6).forEach(i => { html += `<li>${escape(typeof i === 'string' ? i : (i.message || i.title || JSON.stringify(i)))}</li>` })
    html += `</ul></div>`
  }
  if (!html) html = renderRaw(data)
  resultsEl.innerHTML = html
}

function renderTopicalMap(data) {
  const root = data.root_topic || data.root || '—'
  const pillars = data.pillars || data.nodes || data.topics || []

  let html = `<div class="result-card"><div class="result-title">Competitor Topical Map</div><div class="result-body"><strong>Root:</strong> ${escape(root)}</div></div>`
  if (pillars.length) {
    html += `<div class="result-card"><div class="result-title">Pillar Topics <span class="result-score good">${pillars.length}</span></div><ul class="list-compact">`
    pillars.slice(0, 15).forEach(p => {
      const label = typeof p === 'string' ? p : (p.label || p.topic || p.name || JSON.stringify(p))
      html += `<li>${escape(label)}</li>`
    })
    html += `</ul></div>`
  } else {
    html += renderRaw(data)
  }
  resultsEl.innerHTML = html
}

function renderAEO(data) {
  const score = data.aeo_score ?? data.score ?? data.overall_score ?? null
  let html = ''
  if (score !== null) {
    html += `<div class="result-card"><div class="result-title">AEO Eligibility <span class="result-score ${scoreClass(score)}">${score}/100</span></div></div>`
  }
  const engines = data.engines || data.engine_scores || null
  if (engines && typeof engines === 'object') {
    html += `<div class="result-card"><div class="result-title">Per Engine</div><div class="result-stats">`
    Object.entries(engines).slice(0, 6).forEach(([k, v]) => {
      const n = typeof v === 'number' ? v : (v?.score ?? v?.value ?? 0)
      html += `<div class="stat"><div class="stat-label">${escape(k)}</div><div class="stat-value">${Math.round(n)}</div></div>`
    })
    html += `</div></div>`
  }
  if (data.recommendations) {
    const r = Array.isArray(data.recommendations) ? data.recommendations : []
    if (r.length) {
      html += `<div class="result-card"><div class="result-title">Recommendations</div><ul class="list-compact">`
      r.slice(0, 6).forEach(x => { html += `<li>${escape(typeof x === 'string' ? x : (x.title || x.message || JSON.stringify(x)))}</li>` })
      html += `</ul></div>`
    }
  }
  if (!html) html = renderRaw(data)
  resultsEl.innerHTML = html
}

function renderPlagiarism(data) {
  const score = data.similarity_score ?? data.plagiarism_score ?? data.score ?? null
  const matches = data.matches || data.sources || []
  let html = ''
  if (score !== null) {
    // Inverse scoring — low is good
    const good = score < 15 ? 'good' : score < 35 ? 'warn' : 'bad'
    html += `<div class="result-card"><div class="result-title">Plagiarism Check <span class="result-score ${good}">${Math.round(score)}% match</span></div></div>`
  }
  if (matches.length) {
    html += `<div class="result-card"><div class="result-title">Matched Sources <span class="result-score warn">${matches.length}</span></div><ul class="list-compact">`
    matches.slice(0, 8).forEach(m => { html += `<li>${escape(typeof m === 'string' ? m : (m.url || m.source || JSON.stringify(m)))}</li>` })
    html += `</ul></div>`
  }
  if (!html) html = renderRaw(data)
  resultsEl.innerHTML = html
}

function renderTriples(data) {
  const triples = data.triples || data.rdf_triples || []
  let html = `<div class="result-card"><div class="result-title">Semantic Triples <span class="result-score good">${triples.length}</span></div>`
  if (triples.length) {
    html += `<ul class="list-compact">`
    triples.slice(0, 20).forEach(t => {
      if (Array.isArray(t)) html += `<li><code>${escape(t.join(' → '))}</code></li>`
      else if (t.subject || t.predicate || t.object) html += `<li><code>${escape(t.subject)} → ${escape(t.predicate)} → ${escape(t.object)}</code></li>`
      else html += `<li>${escape(JSON.stringify(t))}</li>`
    })
    html += `</ul>`
  } else {
    html += `<div class="result-body">No triples extracted.</div>`
  }
  html += `</div>`
  if (data.schema_jsonld) {
    html += `<div class="result-card"><div class="result-title">Generated Schema</div><pre class="raw">${escape(JSON.stringify(data.schema_jsonld, null, 2))}</pre></div>`
  }
  resultsEl.innerHTML = html
}

function renderRaw(data) {
  return `<div class="result-card"><div class="result-title">Raw Response</div><pre class="raw">${escape(JSON.stringify(data, null, 2))}</pre></div>`
}

// ── Action handlers ────────────────────────────────────────────────
async function runAction(action, label) {
  if (!settings.api_key) {
    renderError('No API key configured. Click Settings.')
    return
  }
  renderLoading(label)
  try {
    const pageData = await extractPageData()
    const clientId = clientSelect.value || settings.default_client_id || null

    const keywordGuess = pageData.title_keyword || (pageData.title || '').toLowerCase().split(/[|\-–—:]/)[0].trim()
    const baseBody = {
      client_id: clientId,
      agency_id: settings.agency_id || null,
      url: currentTabUrl,
    }

    let body = baseBody
    if (action === 'analyze_on_page') {
      body = { ...baseBody, url: currentTabUrl, keyword: keywordGuess, html: pageData.html }
    } else if (action === 'extract_competitor_topical_map') {
      body = { ...baseBody, competitor_url: currentTabUrl, competitor_html: pageData.html }
    } else if (action === 'score_multi_engine_aeo') {
      body = { ...baseBody, url: currentTabUrl, keyword: keywordGuess, html: pageData.html, content: pageData.text }
    } else if (action === 'check_plagiarism') {
      body = { ...baseBody, url: currentTabUrl, content: pageData.text }
    } else if (action === 'generate_triples') {
      body = { ...baseBody, url: currentTabUrl, content: pageData.text, html: pageData.html }
    }

    const res = await callApi(action, body)

    if (action === 'analyze_on_page') renderOnPage(res)
    else if (action === 'extract_competitor_topical_map') renderTopicalMap(res)
    else if (action === 'score_multi_engine_aeo') renderAEO(res)
    else if (action === 'check_plagiarism') renderPlagiarism(res)
    else if (action === 'generate_triples') renderTriples(res)
    else renderRaw(res)
  } catch (e) {
    renderError(e.message)
  }
}

// ── Settings overlay ───────────────────────────────────────────────
function openSettingsPage() {
  const url = chrome.runtime.getURL('popup/settings.html')
  chrome.tabs.create({ url })
}

// ── Boot ───────────────────────────────────────────────────────────
async function boot() {
  await loadSettings()
  updateStatus()

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0]
    if (tab) {
      currentTabId = tab.id
      currentTabUrl = tab.url || ''
      pageUrlEl.textContent = currentTabUrl || '—'
    }
  })

  loadClients()

  // Action wiring
  document.querySelectorAll('.action').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-action')
      const label = btn.textContent.trim()
      document.querySelectorAll('.action').forEach(b => b.disabled = true)
      runAction(action, label).finally(() => {
        document.querySelectorAll('.action').forEach(b => b.disabled = false)
      })
    })
  })

  // Client change
  clientSelect.addEventListener('change', () => {
    settings.default_client_id = clientSelect.value
    chrome.storage.local.set({ kotoiq_settings: settings })
  })

  // Settings link
  openSettingsLink.addEventListener('click', (e) => { e.preventDefault(); openSettingsPage() })
}

boot()
