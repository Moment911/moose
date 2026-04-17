/**
 * Elementor JSON Path Utilities
 *
 * Stable ID-based deep-get/set for _elementor_data trees.
 *
 * Elementor v4 stores the visual tree as a recursive array of elements.
 * Each element has a stable `id` (8-char hex) that survives re-ordering.
 * We use "elementId:settings.property" paths instead of array indices
 * so slot positions survive minor template edits.
 *
 * Example path: "abc12345:settings.title"
 *   → find element with id "abc12345", navigate to .settings.title
 */

export interface ElementorElement {
  id: string
  elType: string            // 'section' | 'container' | 'column' | 'widget'
  widgetType?: string       // 'e-heading' | 'e-button' | 'e-image' | etc (v4 atomic)
  settings: Record<string, any>
  elements?: ElementorElement[]
  [key: string]: any
}

/**
 * Build a stable path string for an element + property.
 * Format: "elementId:dotted.property.path"
 */
export function buildPath(elementId: string, propertyPath: string): string {
  return `${elementId}:${propertyPath}`
}

/**
 * Parse a stable path into { elementId, propertyPath }.
 */
export function parsePath(path: string): { elementId: string; propertyPath: string } {
  const colonIdx = path.indexOf(':')
  if (colonIdx === -1) {
    throw new Error(`[jsonPathUtils] Invalid path "${path}" — expected "elementId:property.path"`)
  }
  return {
    elementId: path.slice(0, colonIdx),
    propertyPath: path.slice(colonIdx + 1),
  }
}

/**
 * Find an element by ID in the recursive tree.
 * Returns null if not found.
 */
export function findElementById(
  elements: ElementorElement[],
  targetId: string
): ElementorElement | null {
  for (const el of elements) {
    if (el.id === targetId) return el
    if (el.elements?.length) {
      const found = findElementById(el.elements, targetId)
      if (found) return found
    }
  }
  return null
}

/**
 * Get a nested property value using dot notation.
 * e.g., getNestedValue(obj, "settings.title") → obj.settings.title
 */
export function getNestedValue(obj: any, path: string): any {
  const parts = path.split('.')
  let current = obj
  for (const part of parts) {
    if (current == null) return undefined
    current = current[part]
  }
  return current
}

/**
 * Set a nested property value using dot notation.
 * Creates intermediate objects as needed.
 * Returns a shallow-cloned path (does not mutate the original).
 */
export function setNestedValue(obj: any, path: string, value: any): any {
  const parts = path.split('.')
  if (parts.length === 1) {
    return { ...obj, [parts[0]]: value }
  }
  const [head, ...rest] = parts
  return {
    ...obj,
    [head]: setNestedValue(obj[head] ?? {}, rest.join('.'), value),
  }
}

/**
 * Deep-get a value from the Elementor tree using a stable path.
 * Path format: "elementId:settings.property"
 */
export function deepGet(
  elements: ElementorElement[],
  stablePath: string
): any {
  const { elementId, propertyPath } = parsePath(stablePath)
  const element = findElementById(elements, elementId)
  if (!element) return undefined
  return getNestedValue(element, propertyPath)
}

/**
 * Deep-set a value in the Elementor tree using a stable path.
 * Returns a new tree (immutable — does not mutate the original).
 * Path format: "elementId:settings.property"
 */
export function deepSet(
  elements: ElementorElement[],
  stablePath: string,
  value: any
): ElementorElement[] {
  const { elementId, propertyPath } = parsePath(stablePath)

  return elements.map(el => {
    if (el.id === elementId) {
      return setNestedValue(el, propertyPath, value)
    }
    if (el.elements?.length) {
      const newChildren = deepSet(el.elements, stablePath, value)
      if (newChildren !== el.elements) {
        return { ...el, elements: newChildren }
      }
    }
    return el
  })
}

/**
 * Walk every element in the tree, calling the visitor for each.
 * Depth-first traversal.
 */
export function walkElements(
  elements: ElementorElement[],
  visitor: (el: ElementorElement, depth: number, parent: ElementorElement | null) => void,
  depth = 0,
  parent: ElementorElement | null = null
): void {
  for (const el of elements) {
    visitor(el, depth, parent)
    if (el.elements?.length) {
      walkElements(el.elements, visitor, depth + 1, el)
    }
  }
}

/**
 * Collect all elements of a given elType or widgetType.
 */
export function collectByType(
  elements: ElementorElement[],
  opts: { elType?: string; widgetType?: string }
): ElementorElement[] {
  const results: ElementorElement[] = []
  walkElements(elements, (el) => {
    if (opts.elType && el.elType === opts.elType) results.push(el)
    if (opts.widgetType && el.widgetType === opts.widgetType) results.push(el)
  })
  return results
}

/**
 * Get a flat map of all element IDs → their widgetType/elType.
 * Useful for quick lookups and schema capture.
 */
export function buildElementIndex(
  elements: ElementorElement[]
): Map<string, { elType: string; widgetType?: string }> {
  const index = new Map<string, { elType: string; widgetType?: string }>()
  walkElements(elements, (el) => {
    index.set(el.id, { elType: el.elType, widgetType: el.widgetType })
  })
  return index
}
