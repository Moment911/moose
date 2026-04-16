import { useEffect } from 'react'

type PageMeta = {
  title: string
  description: string
  ogImage?: string   // absolute URL preferred
  noindex?: boolean
}

/**
 * Set per-page <title>, <meta description>, Open Graph, and Twitter card
 * tags from a client component. Restores the previous values on unmount so
 * SPA navigation doesn't leak stale metadata into other pages.
 *
 * Tags are managed by name/property — existing tags are updated, missing
 * ones are created, previous values snapshotted and restored.
 */
export function usePageMeta(meta: PageMeta) {
  useEffect(() => {
    const prevTitle = document.title
    document.title = meta.title

    // Restore points for anything we touch — so SPA nav doesn't leave dregs
    const restore: Array<() => void> = [() => { document.title = prevTitle }]

    const setMeta = (selector: string, attr: 'name' | 'property', key: string, content: string) => {
      let el = document.head.querySelector(selector) as HTMLMetaElement | null
      const created = !el
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, key)
        document.head.appendChild(el)
      }
      const prevContent = el.getAttribute('content')
      el.setAttribute('content', content)
      restore.push(() => {
        if (created) {
          el!.remove()
        } else if (prevContent !== null) {
          el!.setAttribute('content', prevContent)
        }
      })
    }

    // Basic
    setMeta('meta[name="description"]', 'name', 'description', meta.description)

    // Robots (only if explicitly noindex)
    if (meta.noindex) {
      setMeta('meta[name="robots"]', 'name', 'robots', 'noindex,nofollow')
    }

    // Open Graph
    setMeta('meta[property="og:title"]',       'property', 'og:title', meta.title)
    setMeta('meta[property="og:description"]', 'property', 'og:description', meta.description)
    setMeta('meta[property="og:type"]',        'property', 'og:type', 'website')
    if (meta.ogImage) {
      setMeta('meta[property="og:image"]', 'property', 'og:image', meta.ogImage)
    }

    // Twitter
    setMeta('meta[name="twitter:card"]',        'name', 'twitter:card', meta.ogImage ? 'summary_large_image' : 'summary')
    setMeta('meta[name="twitter:title"]',       'name', 'twitter:title', meta.title)
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', meta.description)
    if (meta.ogImage) {
      setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', meta.ogImage)
    }

    return () => {
      // Restore in reverse order so nested effects unwind cleanly
      for (let i = restore.length - 1; i >= 0; i--) restore[i]()
    }
  }, [meta.title, meta.description, meta.ogImage, meta.noindex])
}
