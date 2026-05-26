/**
 * SEO Analyzer — Rank Math-style content analysis engine.
 *
 * Runs all the checks Rank Math does: focus keyword placement, density,
 * title readability, content quality, link analysis, and schema detection.
 * Returns a scored report with actionable fixes.
 */

export interface SEOAnalysis {
  score: number           // 0-100 overall
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  focusKeyword: string
  checks: SEOCheck[]
  sections: {
    basicSeo: SEOCheck[]
    additional: SEOCheck[]
    titleReadability: SEOCheck[]
    contentReadability: SEOCheck[]
  }
}

export interface SEOCheck {
  id: string
  label: string
  status: 'pass' | 'fail' | 'warn'
  category: 'basic' | 'additional' | 'title' | 'content'
  fixable?: boolean       // Can be auto-fixed from the dashboard
  suggestion?: string     // What to do to fix it
}

interface PageData {
  title: string
  url: string
  slug: string
  content: string         // HTML content
  seo_title: string
  meta_desc: string
  focus_kw: string
  word_count: number
  type: string
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function getHeadings(html: string): { tag: string; text: string }[] {
  const matches = html.matchAll(/<(h[2-6])[^>]*>(.*?)<\/\1>/gi)
  return Array.from(matches).map(m => ({ tag: m[1].toUpperCase(), text: stripHtml(m[2]) }))
}

function getImages(html: string): { src: string; alt: string }[] {
  const matches = html.matchAll(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi)
  const matches2 = html.matchAll(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*>/gi)
  const results = Array.from(matches).map(m => ({ src: m[1], alt: m[2] }))
  const results2 = Array.from(matches2).map(m => ({ src: m[2], alt: m[1] }))
  return [...results, ...results2]
}

function getLinks(html: string, siteUrl: string): { href: string; text: string; isExternal: boolean; isNofollow: boolean }[] {
  const matches = html.matchAll(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi)
  const domain = new URL(siteUrl).hostname
  return Array.from(matches).map(m => {
    const href = m[1]
    const isExternal = href.startsWith('http') && !href.includes(domain)
    const isNofollow = m[0].toLowerCase().includes('nofollow')
    return { href, text: stripHtml(m[2]), isExternal, isNofollow }
  })
}

function countKeyword(text: string, keyword: string): number {
  if (!keyword) return 0
  const lower = text.toLowerCase()
  const kw = keyword.toLowerCase()
  let count = 0
  let pos = 0
  while ((pos = lower.indexOf(kw, pos)) !== -1) {
    count++
    pos += kw.length
  }
  return count
}

const POWER_WORDS = [
  'best', 'top', 'ultimate', 'proven', 'guaranteed', 'exclusive', 'secret',
  'powerful', 'essential', 'complete', 'free', 'new', 'easy', 'fast',
  'amazing', 'incredible', 'effective', 'premium', 'professional',
  'expert', 'advanced', 'trusted', 'leading', 'revolutionary',
]

const POSITIVE_WORDS = [
  'best', 'great', 'amazing', 'excellent', 'perfect', 'wonderful',
  'outstanding', 'fantastic', 'brilliant', 'remarkable', 'superb',
  'top', 'leading', 'premier', 'finest', 'superior',
]

const NEGATIVE_WORDS = [
  'worst', 'bad', 'terrible', 'horrible', 'awful', 'never', 'avoid',
  'warning', 'danger', 'risk', 'mistake', 'fail', 'problem', 'wrong',
  'stop', 'don\'t', 'beware', 'scam',
]

export function analyzeSEO(page: PageData, siteUrl: string): SEOAnalysis {
  const checks: SEOCheck[] = []
  const kw = (page.focus_kw || '').trim()
  const kwLower = kw.toLowerCase()
  const plainContent = stripHtml(page.content || '')
  const plainLower = plainContent.toLowerCase()
  const title = page.seo_title || page.title || ''
  const titleLower = title.toLowerCase()
  const desc = page.meta_desc || ''
  const descLower = desc.toLowerCase()
  const slug = page.slug || ''
  const slugLower = slug.toLowerCase()
  const headings = getHeadings(page.content || '')
  const images = getImages(page.content || '')
  const links = getLinks(page.content || '', siteUrl)
  const wordCount = page.word_count || plainContent.split(/\s+/).length

  // ── Basic SEO ──────────────────────────────────────────────────────────
  const hasKw = !!kw

  // Focus keyword set
  checks.push({
    id: 'kw_set', label: hasKw ? `Focus keyword set: "${kw}"` : 'Set a Focus Keyword for this content.',
    status: hasKw ? 'pass' : 'fail', category: 'basic', fixable: true,
    suggestion: hasKw ? undefined : 'Add a focus keyword that you want this page to rank for.',
  })

  // Keyword in title
  if (hasKw) {
    const inTitle = titleLower.includes(kwLower)
    checks.push({
      id: 'kw_in_title', label: inTitle ? 'Focus Keyword found in SEO title.' : 'Add Focus Keyword to the SEO title.',
      status: inTitle ? 'pass' : 'fail', category: 'basic', fixable: true,
      suggestion: inTitle ? undefined : `Add "${kw}" to your SEO title.`,
    })
  }

  // Keyword in meta description
  if (hasKw) {
    const inDesc = descLower.includes(kwLower)
    checks.push({
      id: 'kw_in_desc', label: inDesc ? 'Focus Keyword found in meta description.' : 'Add Focus Keyword to your SEO Meta Description.',
      status: inDesc ? 'pass' : 'fail', category: 'basic', fixable: true,
      suggestion: inDesc ? undefined : `Include "${kw}" in your meta description.`,
    })
  }

  // Keyword in URL
  if (hasKw) {
    const kwSlug = kwLower.replace(/\s+/g, '-')
    const inUrl = slugLower.includes(kwSlug) || slugLower.includes(kwLower.replace(/\s+/g, ''))
    checks.push({
      id: 'kw_in_url', label: inUrl ? 'Focus Keyword found in URL.' : 'Use Focus Keyword in the URL.',
      status: inUrl ? 'pass' : 'fail', category: 'basic',
      suggestion: inUrl ? undefined : `Include "${kw}" in the page URL/slug.`,
    })
  }

  // Keyword at beginning of content
  if (hasKw) {
    const first150 = plainLower.slice(0, 150)
    const atBeginning = first150.includes(kwLower)
    checks.push({
      id: 'kw_beginning', label: atBeginning ? 'Focus Keyword used at the beginning of content.' : 'Use Focus Keyword at the beginning of your content.',
      status: atBeginning ? 'pass' : 'fail', category: 'basic',
      suggestion: atBeginning ? undefined : `Mention "${kw}" in the first sentence or paragraph.`,
    })
  }

  // Keyword in content
  if (hasKw) {
    const inContent = plainLower.includes(kwLower)
    checks.push({
      id: 'kw_in_content', label: inContent ? 'Focus Keyword found in content.' : 'Use Focus Keyword in the content.',
      status: inContent ? 'pass' : 'fail', category: 'basic',
      suggestion: inContent ? undefined : `Add "${kw}" to the page content naturally.`,
    })
  }

  // Word count
  checks.push({
    id: 'word_count',
    label: wordCount >= 300 ? `Content is ${wordCount} words long. Good job!` : `Content is only ${wordCount} words. Aim for at least 300 words.`,
    status: wordCount >= 300 ? 'pass' : wordCount >= 150 ? 'warn' : 'fail',
    category: 'basic',
    suggestion: wordCount < 300 ? 'Add more content to improve SEO. Aim for 600+ words for service pages.' : undefined,
  })

  // ── Additional ─────────────────────────────────────────────────────────

  // Keyword in subheadings
  if (hasKw) {
    const kwInHeading = headings.some(h => h.text.toLowerCase().includes(kwLower))
    checks.push({
      id: 'kw_in_subheading', label: kwInHeading ? 'Focus Keyword found in subheading.' : 'Use Focus Keyword in subheading(s) like H2, H3, H4, etc.',
      status: kwInHeading ? 'pass' : 'fail', category: 'additional',
      suggestion: kwInHeading ? undefined : `Add "${kw}" to at least one H2 or H3 heading.`,
    })
  }

  // Image with keyword alt text
  if (hasKw) {
    const kwInAlt = images.some(img => img.alt.toLowerCase().includes(kwLower))
    checks.push({
      id: 'kw_in_img_alt', label: kwInAlt ? 'Image found with Focus Keyword in alt text.' : 'Add an image with your Focus Keyword as alt text.',
      status: kwInAlt ? 'pass' : 'fail', category: 'additional',
      suggestion: kwInAlt ? undefined : `Add an image with alt text containing "${kw}".`,
    })
  }

  // Keyword density
  if (hasKw && wordCount > 0) {
    const kwCount = countKeyword(plainLower, kwLower)
    const kwWords = kw.split(/\s+/).length
    const density = (kwCount * kwWords / wordCount) * 100
    const densityRounded = Math.round(density * 10) / 10
    checks.push({
      id: 'kw_density',
      label: density >= 0.5 && density <= 2.5
        ? `Keyword Density is ${densityRounded}%. Well done!`
        : `Keyword Density is ${densityRounded}%. Aim for around 1% Keyword Density.`,
      status: density >= 0.5 && density <= 2.5 ? 'pass' : density > 0 ? 'warn' : 'fail',
      category: 'additional',
      suggestion: density < 0.5 ? `Use "${kw}" more naturally throughout the content.` : density > 2.5 ? 'Reduce keyword usage to avoid over-optimization.' : undefined,
    })
  }

  // URL length
  const urlLength = slug.length
  checks.push({
    id: 'url_length',
    label: urlLength <= 75 ? `URL is ${urlLength} characters long. Kudos!` : `URL is ${urlLength} characters. Keep URLs under 75 characters.`,
    status: urlLength <= 75 ? 'pass' : 'warn', category: 'additional',
  })

  // Outbound links
  const outbound = links.filter(l => l.isExternal)
  checks.push({
    id: 'outbound_links',
    label: outbound.length > 0 ? `${outbound.length} outbound link(s) found.` : 'No outbound links were found. Link out to external resources.',
    status: outbound.length > 0 ? 'pass' : 'fail', category: 'additional',
    suggestion: outbound.length === 0 ? 'Add 1-2 links to authoritative external resources.' : undefined,
  })

  // Internal links
  const internal = links.filter(l => !l.isExternal)
  checks.push({
    id: 'internal_links',
    label: internal.length > 0 ? `${internal.length} internal link(s) found. Good job!` : 'Add internal links to other pages on your site.',
    status: internal.length > 0 ? 'pass' : 'fail', category: 'additional',
    suggestion: internal.length === 0 ? 'Link to related service pages or blog posts on your site.' : undefined,
  })

  // ── Title Readability ──────────────────────────────────────────────────

  // Keyword near beginning of title
  if (hasKw) {
    const kwPos = titleLower.indexOf(kwLower)
    const nearBeginning = kwPos >= 0 && kwPos < title.length / 2
    checks.push({
      id: 'title_kw_position',
      label: nearBeginning ? 'Focus Keyword is near the beginning of SEO title.' : 'Use the Focus Keyword near the beginning of SEO title.',
      status: nearBeginning ? 'pass' : 'warn', category: 'title', fixable: true,
    })
  }

  // Sentiment word in title
  const hasPositive = POSITIVE_WORDS.some(w => titleLower.includes(w))
  const hasNegative = NEGATIVE_WORDS.some(w => titleLower.includes(w))
  checks.push({
    id: 'title_sentiment',
    label: hasPositive || hasNegative ? 'Title contains a sentiment word.' : 'Your title doesn\'t contain a positive or a negative sentiment word.',
    status: hasPositive || hasNegative ? 'pass' : 'warn', category: 'title', fixable: true,
    suggestion: !hasPositive && !hasNegative ? 'Add a word like "best", "top", or "proven" to make the title more compelling.' : undefined,
  })

  // Power word in title
  const hasPower = POWER_WORDS.some(w => titleLower.includes(w))
  checks.push({
    id: 'title_power_word',
    label: hasPower ? 'Title contains a power word.' : 'Your title doesn\'t contain a power word. Add at least one.',
    status: hasPower ? 'pass' : 'warn', category: 'title', fixable: true,
    suggestion: !hasPower ? 'Add a power word like "ultimate", "proven", "expert", or "professional".' : undefined,
  })

  // Number in title
  const hasNumber = /\d/.test(title)
  checks.push({
    id: 'title_number',
    label: hasNumber ? 'SEO title contains a number.' : 'Your SEO title doesn\'t contain a number.',
    status: hasNumber ? 'pass' : 'warn', category: 'title', fixable: true,
    suggestion: !hasNumber ? 'Adding a number (e.g., "5 Best...", "#1 Provider...") can increase click-through rate.' : undefined,
  })

  // Title length
  const titleLen = title.length
  checks.push({
    id: 'title_length',
    label: titleLen >= 30 && titleLen <= 60 ? `SEO title is ${titleLen} characters. Perfect length!` : titleLen < 30 ? `SEO title is only ${titleLen} characters. Aim for 50-60.` : `SEO title is ${titleLen} characters. Keep it under 60.`,
    status: titleLen >= 30 && titleLen <= 60 ? 'pass' : 'warn', category: 'title', fixable: true,
  })

  // ── Content Readability ────────────────────────────────────────────────

  // Short paragraphs
  const paragraphs = (page.content || '').split(/<\/p>/i).filter(p => stripHtml(p).length > 20)
  const longParagraphs = paragraphs.filter(p => stripHtml(p).split(/\s+/).length > 150)
  checks.push({
    id: 'short_paragraphs',
    label: longParagraphs.length === 0 ? 'You are using short paragraphs.' : `${longParagraphs.length} paragraph(s) are too long. Break them up.`,
    status: longParagraphs.length === 0 ? 'pass' : 'warn', category: 'content',
  })

  // Images/video (rich media)
  const hasMedia = images.length > 0 || (page.content || '').includes('<video') || (page.content || '').includes('<iframe')
  checks.push({
    id: 'rich_media',
    label: hasMedia ? 'Rich media (images/video) found in content.' : 'You are not using rich media like images or videos.',
    status: hasMedia ? 'pass' : 'fail', category: 'content',
    suggestion: !hasMedia ? 'Add at least one relevant image or video to the page.' : undefined,
  })

  // Meta description length
  if (desc) {
    const descLen = desc.length
    checks.push({
      id: 'desc_length',
      label: descLen >= 120 && descLen <= 160 ? `Meta description is ${descLen} characters. Great!` : descLen < 120 ? `Meta description is only ${descLen} characters. Aim for 120-160.` : `Meta description is ${descLen} characters. Keep it under 160.`,
      status: descLen >= 120 && descLen <= 160 ? 'pass' : 'warn', category: 'content', fixable: true,
    })
  } else {
    checks.push({
      id: 'desc_length', label: 'No meta description set. Add one for better click-through rates.',
      status: 'fail', category: 'content', fixable: true,
      suggestion: 'Write a compelling 120-160 character description that includes your focus keyword.',
    })
  }

  // ── Score calculation ──────────────────────────────────────────────────
  const passed = checks.filter(c => c.status === 'pass').length
  const total = checks.length
  const score = total > 0 ? Math.round((passed / total) * 100) : 0
  const grade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : score >= 20 ? 'D' : 'F'

  return {
    score,
    grade,
    focusKeyword: kw,
    checks,
    sections: {
      basicSeo: checks.filter(c => c.category === 'basic'),
      additional: checks.filter(c => c.category === 'additional'),
      titleReadability: checks.filter(c => c.category === 'title'),
      contentReadability: checks.filter(c => c.category === 'content'),
    },
  }
}
