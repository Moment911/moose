// KotoIQ SEO Intel — content script
// Extracts structured page data and responds to messages from the popup.
// Also injects a small floating access button on pages (optional, off by default).

(function () {
  if (window.__kotoiqInjected) return
  window.__kotoiqInjected = true

  // ── Extract data from the DOM ───────────────────────────────────────
  function extractPageData() {
    const html = document.documentElement.outerHTML

    // Clone the body and strip nav/footer/header/aside/script/style so we get
    // primary content only.
    const clone = document.body ? document.body.cloneNode(true) : document.createElement('div')
    ;['nav', 'header', 'footer', 'aside', 'script', 'style', 'noscript', 'form'].forEach(tag => {
      clone.querySelectorAll(tag).forEach(el => el.remove())
    })
    const text = clone.textContent.replace(/\s+/g, ' ').trim()

    // Headings
    const headings = {
      h1: Array.from(document.querySelectorAll('h1')).map(h => h.textContent.trim()).filter(Boolean),
      h2: Array.from(document.querySelectorAll('h2')).map(h => h.textContent.trim()).filter(Boolean),
      h3: Array.from(document.querySelectorAll('h3')).map(h => h.textContent.trim()).filter(Boolean),
    }

    // Title + meta
    const title = document.title || ''
    const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') || ''
    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || location.href
    const robots = document.querySelector('meta[name="robots"]')?.getAttribute('content') || ''
    const viewport = document.querySelector('meta[name="viewport"]')?.getAttribute('content') || ''

    // Open Graph
    const og = {}
    document.querySelectorAll('meta[property^="og:"]').forEach(m => {
      og[m.getAttribute('property').replace('og:', '')] = m.getAttribute('content')
    })

    // Twitter
    const twitter = {}
    document.querySelectorAll('meta[name^="twitter:"]').forEach(m => {
      twitter[m.getAttribute('name').replace('twitter:', '')] = m.getAttribute('content')
    })

    // JSON-LD schemas
    const schemas = []
    document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
      try { schemas.push(JSON.parse(s.textContent)) } catch { /* malformed */ }
    })

    // Keyword guess from first H1 or title
    const titleKeyword = (headings.h1[0] || title.split(/[|\-–—:]/)[0]).toLowerCase().trim()

    // Links
    const allLinks = Array.from(document.querySelectorAll('a[href]'))
    let internal = 0, external = 0
    const host = location.hostname
    allLinks.forEach(a => {
      try {
        const u = new URL(a.href, location.href)
        if (u.hostname === host) internal++
        else if (u.hostname) external++
      } catch { /* skip */ }
    })

    // Images
    const imgs = Array.from(document.querySelectorAll('img'))
    const imageCount = imgs.length
    const imagesWithAlt = imgs.filter(i => i.getAttribute('alt')?.trim()).length

    return {
      url: location.href,
      title,
      title_keyword: titleKeyword,
      meta_description: metaDesc,
      canonical,
      robots,
      viewport,
      html,
      text: text.slice(0, 40000), // cap to keep payload reasonable
      word_count: text.split(/\s+/).filter(Boolean).length,
      headings,
      h1_count: headings.h1.length,
      h2_count: headings.h2.length,
      h3_count: headings.h3.length,
      og,
      twitter,
      schemas,
      schema_count: schemas.length,
      schema_types: schemas.map(s => s['@type']).filter(Boolean),
      internal_links: internal,
      external_links: external,
      image_count: imageCount,
      images_with_alt: imagesWithAlt,
    }
  }

  // ── Message listener ────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === 'kotoiq_extract') {
      try {
        const data = extractPageData()
        sendResponse(data)
      } catch (e) {
        sendResponse({ error: e.message })
      }
      return true
    }

    if (msg?.type === 'kotoiq_ping') {
      sendResponse({ ok: true })
      return true
    }

    return false
  })
})()
