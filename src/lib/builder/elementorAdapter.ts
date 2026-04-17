/**
 * Elementor v4 Adapter — Schema Capture + Registry (ELEM-05, ELEM-06)
 *
 * Captures the actual widget shape from live Elementor v4 JSON,
 * builds a versioned schema, detects drift, and pins per-site.
 *
 * Key design decisions (from .planning/research/ARCHITECTURE.md):
 * - Capture, don't assume: schema derived from live JSON, not docs
 * - Adapter reads schema, not hardcoded widget list
 * - Version drift detection: no-change / additive / breaking
 * - Per-site pinning: clients on v4.0.2 stay on v4.0.2
 */

import { walkElements, type ElementorElement } from './jsonPathUtils'

// ── Types ───────────────────────────────────────────────────────────────────

/** Shape of a single widget type's settings, derived from live JSON */
export interface WidgetSettingsSchema {
  /** All setting keys observed, with their value types */
  properties: Record<string, SettingPropertySchema>
  /** Sample values seen (first occurrence only, for reference) */
  samples: Record<string, any>
}

export interface SettingPropertySchema {
  /** JS typeof the value: 'string' | 'number' | 'boolean' | 'object' | 'array' */
  type: string
  /** Whether this was seen on every instance of the widget type */
  required: boolean
  /** For strings: max length observed */
  maxLength?: number
  /** For arrays: element type if uniform */
  arrayItemType?: string
  /** Number of instances where this property appeared */
  occurrences: number
}

/** The full captured schema for a site's Elementor installation */
export interface CapturedSchema {
  /** Elementor version this was captured from */
  elementorVersion: string
  /** Map of widgetType → settings shape */
  widgets: Record<string, WidgetSettingsSchema>
  /** Map of elType (section/container/column) → settings shape */
  structural: Record<string, WidgetSettingsSchema>
  /** All unique CSS classes referenced across elements */
  cssClasses: string[]
  /** Capture metadata */
  capturedAt: string
  capturedFromPostId: number
  totalElements: number
  totalWidgets: number
}

/** Result of comparing two schemas */
export interface SchemaDiff {
  status: 'clean' | 'additive' | 'breaking'
  /** New widget types not in the pinned schema */
  addedWidgets: string[]
  /** Widget types removed from the new capture */
  removedWidgets: string[]
  /** Properties added to existing widget types */
  addedProperties: Array<{ widgetType: string; property: string; type: string }>
  /** Properties removed from existing widget types */
  removedProperties: Array<{ widgetType: string; property: string }>
  /** Properties whose type changed */
  changedTypes: Array<{ widgetType: string; property: string; was: string; now: string }>
}

// ── Schema Capture ──────────────────────────────────────────────────────────

/**
 * Capture a schema from live Elementor v4 JSON.
 *
 * Walks the full element tree, collects every widget type + its settings shape,
 * and builds a CapturedSchema suitable for persisting to kotoiq_elementor_schema_versions.
 */
export function captureSchema(
  elementorData: ElementorElement[],
  elementorVersion: string,
  postId: number
): CapturedSchema {
  const widgetMap = new Map<string, { instances: Record<string, any>[] }>()
  const structuralMap = new Map<string, { instances: Record<string, any>[] }>()
  const allClasses = new Set<string>()
  let totalElements = 0
  let totalWidgets = 0

  walkElements(elementorData, (el) => {
    totalElements++

    // Collect CSS classes
    if (el.settings?._css_classes) {
      String(el.settings._css_classes).split(/\s+/).forEach(c => c && allClasses.add(c))
    }
    if (el.settings?.css_classes) {
      String(el.settings.css_classes).split(/\s+/).forEach(c => c && allClasses.add(c))
    }
    // v4 atomic widgets use className
    if (el.settings?.className) {
      String(el.settings.className).split(/\s+/).forEach(c => c && allClasses.add(c))
    }

    const settings = el.settings || {}
    const isWidget = el.elType === 'widget' && el.widgetType

    if (isWidget) {
      totalWidgets++
      const key = el.widgetType!
      if (!widgetMap.has(key)) widgetMap.set(key, { instances: [] })
      widgetMap.get(key)!.instances.push(settings)
    } else if (el.elType) {
      const key = el.elType
      if (!structuralMap.has(key)) structuralMap.set(key, { instances: [] })
      structuralMap.get(key)!.instances.push(settings)
    }
  })

  return {
    elementorVersion,
    widgets: buildSchemaFromInstances(widgetMap),
    structural: buildSchemaFromInstances(structuralMap),
    cssClasses: Array.from(allClasses).sort(),
    capturedAt: new Date().toISOString(),
    capturedFromPostId: postId,
    totalElements,
    totalWidgets,
  }
}

/**
 * Build settings schemas from collected instances.
 */
function buildSchemaFromInstances(
  map: Map<string, { instances: Record<string, any>[] }>
): Record<string, WidgetSettingsSchema> {
  const result: Record<string, WidgetSettingsSchema> = {}

  for (const [type, { instances }] of map) {
    const allKeys = new Map<string, { type: string; count: number; maxLength: number; sample: any }>()

    for (const settings of instances) {
      for (const [key, value] of Object.entries(settings)) {
        // Skip internal Elementor keys that aren't part of the widget schema
        if (key.startsWith('__')) continue

        const valueType = inferType(value)
        const existing = allKeys.get(key)

        if (!existing) {
          allKeys.set(key, {
            type: valueType,
            count: 1,
            maxLength: typeof value === 'string' ? value.length : 0,
            sample: value,
          })
        } else {
          existing.count++
          if (typeof value === 'string' && value.length > existing.maxLength) {
            existing.maxLength = value.length
          }
          // If types differ across instances, widen to 'mixed'
          if (existing.type !== valueType && valueType !== 'null') {
            existing.type = 'mixed'
          }
        }
      }
    }

    const properties: Record<string, SettingPropertySchema> = {}
    const samples: Record<string, any> = {}

    for (const [key, info] of allKeys) {
      properties[key] = {
        type: info.type,
        required: info.count === instances.length,
        occurrences: info.count,
        ...(info.type === 'string' && info.maxLength > 0 ? { maxLength: info.maxLength } : {}),
      }
      samples[key] = info.sample
    }

    result[type] = { properties, samples }
  }

  return result
}

function inferType(value: any): string {
  if (value === null || value === undefined) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

// ── Schema Diffing (ELEM-06) ────────────────────────────────────────────────

/**
 * Compare a newly captured schema against a pinned schema.
 *
 * Classification:
 * - clean: identical widget types + properties
 * - additive: new widgets or new properties (safe to proceed, schedule re-pin)
 * - breaking: removed widgets, removed properties, or changed types (block publish)
 */
export function diffSchemas(pinned: CapturedSchema, current: CapturedSchema): SchemaDiff {
  const addedWidgets: string[] = []
  const removedWidgets: string[] = []
  const addedProperties: SchemaDiff['addedProperties'] = []
  const removedProperties: SchemaDiff['removedProperties'] = []
  const changedTypes: SchemaDiff['changedTypes'] = []

  const pinnedTypes = new Set(Object.keys(pinned.widgets))
  const currentTypes = new Set(Object.keys(current.widgets))

  // Check for added/removed widget types
  for (const wt of currentTypes) {
    if (!pinnedTypes.has(wt)) addedWidgets.push(wt)
  }
  for (const wt of pinnedTypes) {
    if (!currentTypes.has(wt)) removedWidgets.push(wt)
  }

  // Check properties on shared widget types
  for (const wt of pinnedTypes) {
    if (!currentTypes.has(wt)) continue // already in removedWidgets

    const pinnedProps = pinned.widgets[wt].properties
    const currentProps = current.widgets[wt].properties
    const pinnedKeys = new Set(Object.keys(pinnedProps))
    const currentKeys = new Set(Object.keys(currentProps))

    for (const key of currentKeys) {
      if (!pinnedKeys.has(key)) {
        addedProperties.push({
          widgetType: wt,
          property: key,
          type: currentProps[key].type,
        })
      }
    }

    for (const key of pinnedKeys) {
      if (!currentKeys.has(key)) {
        removedProperties.push({ widgetType: wt, property: key })
      } else if (pinnedProps[key].type !== currentProps[key].type) {
        changedTypes.push({
          widgetType: wt,
          property: key,
          was: pinnedProps[key].type,
          now: currentProps[key].type,
        })
      }
    }
  }

  // Classify
  const hasBreaking =
    removedWidgets.length > 0 ||
    removedProperties.length > 0 ||
    changedTypes.length > 0

  const hasAdditive =
    addedWidgets.length > 0 ||
    addedProperties.length > 0

  const status = hasBreaking ? 'breaking' : hasAdditive ? 'additive' : 'clean'

  return {
    status,
    addedWidgets,
    removedWidgets,
    addedProperties,
    removedProperties,
    changedTypes,
  }
}

// ── Slot Detection (preview — full implementation in Plan 4 of Phase 1) ─────

/** Widget types that are likely to contain fillable text content */
const TEXT_WIDGET_TYPES = new Set([
  // v4 atomic widgets
  'e-heading', 'e-text-editor', 'e-button', 'e-image',
  // v3 legacy widgets (in case site hasn't fully migrated)
  'heading', 'text-editor', 'button', 'image', 'icon-box',
  'image-box', 'call-to-action',
])

/**
 * Widget type → default slot mappings.
 * Slots are detected by widget type, NOT by whether content exists.
 * Empty widgets still get slots — content comes from the engines (PageIQ, hyperlocalContentEngine, etc.)
 */
const WIDGET_SLOT_MAP: Record<string, Array<{ settingKey: string; slotKind: string }>> = {
  // v4 atomic widgets
  'e-heading':     [{ settingKey: 'title', slotKind: 'heading' }],
  'e-text-editor': [{ settingKey: 'editor', slotKind: 'paragraph' }],
  'e-button':      [{ settingKey: 'text', slotKind: 'button_text' }, { settingKey: 'url.url', slotKind: 'button_url' }],
  'e-image':       [{ settingKey: 'image.url', slotKind: 'image_url' }, { settingKey: 'image.alt', slotKind: 'image_alt' }],
  'e-icon-box':    [{ settingKey: 'title_text', slotKind: 'heading' }, { settingKey: 'description_text', slotKind: 'paragraph' }],
  // v3 legacy widgets
  'heading':       [{ settingKey: 'title', slotKind: 'heading' }],
  'text-editor':   [{ settingKey: 'editor', slotKind: 'paragraph' }],
  'button':        [{ settingKey: 'text', slotKind: 'button_text' }, { settingKey: 'link.url', slotKind: 'button_url' }],
  'image':         [{ settingKey: 'image.url', slotKind: 'image_url' }, { settingKey: 'image.alt', slotKind: 'image_alt' }],
  'image-box':     [{ settingKey: 'title_text', slotKind: 'heading' }, { settingKey: 'description_text', slotKind: 'paragraph' }, { settingKey: 'image.url', slotKind: 'image_url' }],
  'icon-box':      [{ settingKey: 'title_text', slotKind: 'heading' }, { settingKey: 'description_text', slotKind: 'paragraph' }],
  'call-to-action':[{ settingKey: 'title', slotKind: 'heading' }, { settingKey: 'description', slotKind: 'paragraph' }, { settingKey: 'button_text', slotKind: 'button_text' }, { settingKey: 'link.url', slotKind: 'button_url' }],
}

/** Fallback: settings keys to check on any unrecognized widget */
const FALLBACK_SLOT_SETTINGS: Array<{ settingKey: string; slotKind: string }> = [
  { settingKey: 'title', slotKind: 'heading' },
  { settingKey: 'editor', slotKind: 'paragraph' },
  { settingKey: 'text', slotKind: 'button_text' },
  { settingKey: 'description_text', slotKind: 'paragraph' },
  { settingKey: 'title_text', slotKind: 'heading' },
]

export interface DetectedSlot {
  /** Stable path: "elementId:settings.property" */
  jsonPath: string
  /** Classification */
  slotKind: string
  /** Current value in the template (empty string if widget has no content yet) */
  currentValue: any
  /** Widget type this belongs to */
  widgetType: string
  /** Suggested label */
  suggestedLabel: string
}

/**
 * Auto-detect fillable slots in an Elementor template.
 *
 * Detects by WIDGET TYPE, not by content presence.
 * Empty widgets get slots — content comes from the engines (PageIQ, hyperlocalContentEngine, etc.)
 */
export function detectSlots(elementorData: ElementorElement[]): DetectedSlot[] {
  const slots: DetectedSlot[] = []
  let order = 0

  walkElements(elementorData, (el) => {
    if (!el.widgetType) return // only widgets, not structural elements

    const wt = el.widgetType
    const settings = el.settings || {}

    // Get slot mappings for this widget type
    const mappings = WIDGET_SLOT_MAP[wt]

    if (mappings) {
      // Known widget type — create a slot for each mapping
      for (const { settingKey, slotKind } of mappings) {
        const value = getSettingValue(settings, settingKey)
        slots.push({
          jsonPath: `${el.id}:settings.${settingKey}`,
          slotKind,
          currentValue: value ?? '',
          widgetType: wt,
          suggestedLabel: `${wt}_${slotKind}_${++order}`,
        })
      }
    } else if (TEXT_WIDGET_TYPES.has(wt)) {
      // Known text-capable type without explicit mapping — try fallbacks
      for (const { settingKey, slotKind } of FALLBACK_SLOT_SETTINGS) {
        if (settingKey in settings || getSettingValue(settings, settingKey) !== undefined) {
          slots.push({
            jsonPath: `${el.id}:settings.${settingKey}`,
            slotKind,
            currentValue: getSettingValue(settings, settingKey) ?? '',
            widgetType: wt,
            suggestedLabel: `${wt}_${slotKind}_${++order}`,
          })
        }
      }
    }
  })

  return slots
}

function getSettingValue(settings: Record<string, any>, key: string): any {
  const parts = key.split('.')
  let current: any = settings
  for (const part of parts) {
    if (current == null) return undefined
    current = current[part]
  }
  return current
}
