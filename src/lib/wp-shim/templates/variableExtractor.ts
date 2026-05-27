// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 Plan 09 Task 1 — variable extractor for Option B page-design model.
//
// Walks an Elementor JSON tree (v4 atomic shape: array of nodes with
// .id / .elType / .widgetType / .settings / .elements) and surfaces every
// user-facing string leaf as a named variable. The substituted tree replaces
// each value with a `{var}` placeholder; the variables[] schema records the
// original value, JSON path, type, and originating element_id.
//
// Round-trip property: extractVariables(tree) followed by
// substituteVariables(extracted.tree, originals) reconstructs the source tree
// byte-for-byte. The captureTemplate flow stores the placeholder tree +
// variables[]; pushTemplate substitutes per-row values + emits via
// elementorSave. Array variable values wrap with [koto_rotate] (Plan 06
// shortcode) for per-render content rotation.
//
// Heuristic mode (default): names are slug-ified from the first 4 words of
// each value, collision-suffixed with an index. opts.useLLM=true switches to
// Claude haiku-4-5 for context-aware variable naming (e.g., "hero_headline"
// instead of "welcome_to_acme_plumbing"). LLM mode is opt-in — captureTemplate
// surfaces it via opts.useLLM but doesn't enable by default (free path is
// good enough for v1; LLM ships when the dashboard wizard exposes it).
//
// Per CLAUDE.md (kotoiq_models memory): the LLM path uses haiku-4-5 and logs
// via logTokenUsage feature='shim_template_capture_var_name'. logTokenUsage
// is imported only when opts.useLLM is true to keep the module
// dependency-light for the common heuristic path.
// ─────────────────────────────────────────────────────────────────────────────

export type VariableType = 'text' | 'image_url' | 'link_url' | 'list'

/** One declared variable surfaced from an Elementor tree by extractVariables. */
export interface Variable {
    /** Slug-safe placeholder name, e.g. "hero_headline_1". Unique per extraction. */
    name: string
    /** Optional display label (defaults to the name's titlecase). */
    label?: string
    /** Original value found in the tree (string for text/url, array for repeater hints). */
    value: string | string[]
    /** Dotted JSON path of the first occurrence in the source tree. */
    path: string
    /** Heuristic type tag — drives UI input shape (textarea / image picker / URL field). */
    type: VariableType
    /** Owning Elementor element's id (when present in the source). */
    element_id?: string
}

export interface ExtractionResult {
    /** Tree with every variable value replaced by a `{name}` placeholder. */
    tree: unknown
    /** Flat schema of extracted variables (dedup'd by source value). */
    variables: Variable[]
}

export interface ExtractVariablesOptions {
    /** When true, ask haiku-4-5 to suggest semantic names for each variable. */
    useLLM?: boolean
    /** Pre-supplied name hints keyed by original value (caller can override). */
    existingVarHints?: Record<string, string>
}

export interface SubstituteVariablesOptions {
    /**
     * Cache duration passed through to the [koto_rotate] shortcode when a
     * variable value is an Array. Default "7d" matches the koto_rotate
     * shortcode default. Set to "0" for per-render rotation.
     */
    rotationCacheDuration?: string
}

// ── Heuristic classifiers ────────────────────────────────────────────────────

const IMAGE_EXT_RE = /\.(jpg|jpeg|png|webp|gif|svg|avif)(\?.*)?$/i
const URL_RE = /^https?:\/\//i
const HEX_COLOR_RE = /^#?[0-9a-f]{3,8}$/i
const CSS_SELECTOR_RE = /^[#.][a-z][a-z0-9_-]*$/i
const NUMERIC_ONLY_RE = /^-?\d+(\.\d+)?(px|em|rem|%|deg|s|ms)?$/i
// Single short alpha word ("left", "right", "yes", "no") — likely a config enum.
const SHORT_ENUM_RE = /^[a-z]{1,6}$/i

// Elementor metadata keys whose values describe element shape (NOT user content).
// We must never extract these as variables — they identify the node, not its
// rendered text. Note that `text`, `title`, `caption`, etc. ARE user content.
const ELEMENTOR_META_KEYS = new Set([
    'id',
    'elType',
    'widgetType',
    'isInner',
    'version',
    '_element_id',
])

function isVariableCandidate(s: unknown): s is string {
    if (typeof s !== 'string') return false
    if (s.length < 3) return false
    if (!/[a-zA-Z]/.test(s)) return false
    if (HEX_COLOR_RE.test(s)) return false
    if (CSS_SELECTOR_RE.test(s)) return false
    if (NUMERIC_ONLY_RE.test(s)) return false
    if (SHORT_ENUM_RE.test(s)) return false
    // Already a placeholder token from a prior pass — never re-extract.
    if (/^\{[a-z0-9_]+\}$/i.test(s)) return false
    return true
}

function detectType(s: string): VariableType {
    if (URL_RE.test(s) && IMAGE_EXT_RE.test(s)) return 'image_url'
    if (URL_RE.test(s)) return 'link_url'
    return 'text'
}

// ── Name generation ─────────────────────────────────────────────────────────

function slugify(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_+/g, '_')
        .split('_')
        .slice(0, 4)
        .join('_')
}

function generateVarName(
    value: string,
    elType: string | undefined,
    settingKey: string,
    taken: Map<string, string>,
): string {
    // For URLs: pick a slug from the URL host+last-segment.
    let basis = value
    if (URL_RE.test(value)) {
        const cleaned = value.replace(URL_RE, '').replace(/\?.*$/, '').replace(/\/$/, '')
        const lastSeg = cleaned.split('/').pop() || ''
        basis = lastSeg.replace(IMAGE_EXT_RE, '') || cleaned
    }
    let slug = slugify(basis)
    if (!slug) slug = slugify(settingKey) || 'var'
    // Prefix with element type for disambiguation if we have it.
    if (elType && elType !== 'widget' && elType !== 'section') {
        slug = `${slugify(elType)}_${slug}`
    } else if (elType === 'widget' && settingKey) {
        // Lean on the setting key (title / caption / text) for widget context.
        const setSlug = slugify(settingKey)
        if (setSlug && !slug.startsWith(setSlug)) {
            slug = `${setSlug}_${slug}`
        }
    }
    // Cap length, then dedupe with counter.
    if (slug.length > 40) slug = slug.slice(0, 40).replace(/_+$/, '')
    const usedNames = new Set(taken.values())
    if (!usedNames.has(slug)) return slug
    let n = 2
    while (usedNames.has(`${slug}_${n}`)) n++
    return `${slug}_${n}`
}

// ── Tree walker ─────────────────────────────────────────────────────────────

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function deepClone<T>(v: T): T {
    // structuredClone is available in Node >=17 / modern browsers and is
    // significantly faster than JSON round-trip for large trees.
    if (typeof globalThis.structuredClone === 'function') {
        return globalThis.structuredClone(v)
    }
    return JSON.parse(JSON.stringify(v)) as T
}

/**
 * Walk a cloned Elementor tree depth-first, replacing every variable-candidate
 * leaf string with a `{name}` token and pushing a Variable row into `out`.
 *
 * `placeholders` dedups identical source values to the SAME variable so that
 * the round-trip property holds — every "Acme Plumbing" string in the tree
 * becomes the same `{acme_plumbing}` token.
 */
function walkAndReplace(
    node: unknown,
    path: string,
    elContext: { elType?: string; element_id?: string },
    placeholders: Map<string, string>,
    out: Variable[],
    hints: Record<string, string>,
): void {
    if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i++) {
            walkAndReplace(node[i], `${path}[${i}]`, elContext, placeholders, out, hints)
        }
        return
    }
    if (!isPlainObject(node)) return

    // Track element-level context as we descend.
    const nextContext = { ...elContext }
    if (typeof node.id === 'string') nextContext.element_id = node.id
    if (typeof node.elType === 'string') nextContext.elType = node.elType
    if (typeof node.widgetType === 'string') nextContext.elType = node.widgetType

    for (const key of Object.keys(node)) {
        const val = node[key]
        const childPath = `${path}.${key}`

        if (typeof val === 'string') {
            // Elementor metadata keys (id, elType, widgetType) describe the
            // node's shape, never user content — skip extraction on those.
            if (ELEMENTOR_META_KEYS.has(key)) continue
            if (!isVariableCandidate(val)) continue
            const existingName = placeholders.get(val)
            if (existingName) {
                node[key] = `{${existingName}}`
                continue
            }
            const hint = hints[val]
            const name =
                (hint && /^[a-z][a-z0-9_]*$/.test(hint) ? hint : null) ??
                generateVarName(val, nextContext.elType, key, placeholders)
            placeholders.set(val, name)
            out.push({
                name,
                value: val,
                path: childPath,
                type: detectType(val),
                element_id: nextContext.element_id,
            })
            node[key] = `{${name}}`
            continue
        }
        if (Array.isArray(val) || isPlainObject(val)) {
            walkAndReplace(val, childPath, nextContext, placeholders, out, hints)
        }
    }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Extract variables from an Elementor JSON tree.
 *
 * Returns a deep-cloned tree with every user-facing string replaced by a
 * `{name}` placeholder, plus the flat schema describing each variable.
 *
 * Identical source values are dedup'd to the same variable name so that the
 * round-trip property holds: substituteVariables(result.tree, originals) ===
 * source.
 */
export async function extractVariables(
    elementorTree: unknown,
    opts: ExtractVariablesOptions = {},
): Promise<ExtractionResult> {
    const cloned = deepClone(elementorTree)
    const placeholders = new Map<string, string>()
    const variables: Variable[] = []
    const hints = opts.existingVarHints ?? {}
    walkAndReplace(cloned, '$', { elType: undefined, element_id: undefined }, placeholders, variables, hints)

    // LLM-assisted naming is an opt-in second pass. It receives the heuristic
    // names + original values and returns one suggested name per variable;
    // we apply the suggestion only when it parses as a valid slug and would
    // not collide with another variable name we've already kept.
    if (opts.useLLM && variables.length > 0) {
        const suggestions = await suggestVariableNamesWithLLM(variables)
        applyLLMSuggestions(cloned, variables, suggestions)
    }

    return { tree: cloned, variables }
}

/**
 * Substitute variable values into a placeholder tree.
 *
 * For each `{name}` token in any string leaf:
 *   - string value     → token replaced inline
 *   - Array<string>    → token replaced with a [koto_rotate] shortcode envelope
 *                        (Plan 06 generic variant-picker; rotation occurs at
 *                        WP request time, not in the dashboard)
 *   - missing/undefined→ token replaced with empty string
 *
 * Returns a fresh deep-cloned tree; never mutates the input.
 */
export function substituteVariables(
    tree: unknown,
    values: Record<string, string | string[]>,
    opts: SubstituteVariablesOptions = {},
): unknown {
    const cache = opts.rotationCacheDuration ?? '7d'
    const cloned = deepClone(tree)

    const substituteString = (input: string): string => {
        // First pass — if the WHOLE string is a single token, support array
        // (rotation) replacement; the [koto_rotate] envelope is the entire
        // setting value. If the token is embedded in a larger string, only
        // scalar substitution is supported (array → empty wrap with rotate).
        const wholeMatch = input.match(/^\{([a-z][a-z0-9_]*)\}$/i)
        if (wholeMatch) {
            const name = wholeMatch[1]
            const v = values[name]
            if (Array.isArray(v)) {
                if (v.length === 0) return ''
                const joined = v.join('|||KOTO_VARIANT|||')
                return `[koto_rotate cache="${cache}" section="${name}"]${joined}[/koto_rotate]`
            }
            if (v === undefined || v === null) return ''
            return String(v)
        }
        // Mixed string + tokens — scalar substitution; arrays become empty.
        return input.replace(/\{([a-z][a-z0-9_]*)\}/gi, (_full, name: string) => {
            const v = values[name]
            if (Array.isArray(v)) return v.length > 0 ? v[0] : ''
            if (v === undefined || v === null) return ''
            return String(v)
        })
    }

    const walk = (node: unknown): void => {
        if (Array.isArray(node)) {
            for (let i = 0; i < node.length; i++) {
                const child = node[i]
                if (typeof child === 'string') node[i] = substituteString(child)
                else if (child && typeof child === 'object') walk(child)
            }
            return
        }
        if (!isPlainObject(node)) return
        for (const key of Object.keys(node)) {
            const val = node[key]
            if (typeof val === 'string') node[key] = substituteString(val)
            else if (val && typeof val === 'object') walk(val)
        }
    }

    walk(cloned)
    return cloned
}

// ── LLM-assisted naming (opt-in path) ────────────────────────────────────────

interface LLMSuggestion {
    /** Index into the variables[] array we passed in. */
    i: number
    /** Suggested slug — validated server-side before applying. */
    name: string
}

/**
 * Ask Claude haiku-4-5 to suggest semantic variable names. Returns suggestions
 * keyed by index. The caller (`extractVariables`) validates each suggestion
 * matches `/^[a-z][a-z0-9_]*$/` and would not collide before applying.
 *
 * Per CLAUDE.md kotoiq_models: uses haiku-4-5 (cheap), logs via logTokenUsage
 * feature='shim_template_capture_var_name'. The import is deferred so the
 * heuristic-only path doesn't pull the Anthropic SDK + Supabase client.
 */
async function suggestVariableNamesWithLLM(
    variables: Variable[],
): Promise<LLMSuggestion[]> {
    // Defer imports so heuristic mode stays dependency-light.
    let Anthropic: unknown
    let logTokenUsage: ((args: unknown) => Promise<void>) | null = null
    try {
        const mod = (await import('@anthropic-ai/sdk')) as unknown as {
            default: new (opts: { apiKey?: string }) => unknown
        }
        Anthropic = mod.default
    } catch {
        return [] // SDK absent — silent no-op; heuristic names already in place
    }
    try {
        // logTokenUsage lives in src/lib/supabase.js per CLAUDE.md. It's a
        // best-effort log; absence shouldn't break extraction.
        const mod = (await import('../../supabase')) as unknown as {
            logTokenUsage?: (args: unknown) => Promise<void>
        }
        if (typeof mod.logTokenUsage === 'function') logTokenUsage = mod.logTokenUsage
    } catch {
        // ignore
    }
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey || !Anthropic) return []
    const AnthropicCtor = Anthropic as new (opts: { apiKey: string }) => {
        messages: {
            create: (req: unknown) => Promise<{
                content: Array<{ type: string; text?: string }>
                usage?: { input_tokens?: number; output_tokens?: number }
            }>
        }
    }
    const client = new AnthropicCtor({ apiKey })
    const summary = variables
        .slice(0, 50)
        .map(
            (v, i) =>
                `${i}. ${v.type} via ${v.path} (current="${v.name}", value="${String(v.value).slice(0, 80)}")`,
        )
        .join('\n')
    const prompt = `You are naming variables for a webpage template. Each row has a current placeholder name and the original value it replaced. Suggest a better short snake_case name (max 30 chars, /^[a-z][a-z0-9_]*$/) reflecting the role on the page (e.g. hero_headline, service_1_title, cta_url). Return ONLY a JSON array of {"i":<index>, "name":"<slug>"} objects — no prose.\n\n${summary}`
    try {
        const resp = await client.messages.create({
            model: 'claude-haiku-4-5',
            max_tokens: 800,
            messages: [{ role: 'user', content: prompt }],
        })
        if (logTokenUsage) {
            try {
                await logTokenUsage({
                    feature: 'shim_template_capture_var_name',
                    model: 'claude-haiku-4-5',
                    input_tokens: resp.usage?.input_tokens ?? 0,
                    output_tokens: resp.usage?.output_tokens ?? 0,
                })
            } catch {
                // ignore log failures
            }
        }
        const text = (resp.content || []).find((b) => b.type === 'text')?.text ?? ''
        const match = text.match(/\[[\s\S]*\]/)
        if (!match) return []
        const arr = JSON.parse(match[0]) as Array<{ i: number; name: string }>
        return arr.filter(
            (s) =>
                typeof s.name === 'string' &&
                /^[a-z][a-z0-9_]*$/.test(s.name) &&
                s.name.length <= 30 &&
                typeof s.i === 'number',
        )
    } catch {
        return [] // any LLM failure → keep heuristic names
    }
}

function applyLLMSuggestions(
    tree: unknown,
    variables: Variable[],
    suggestions: LLMSuggestion[],
): void {
    if (suggestions.length === 0) return
    const taken = new Set(variables.map((v) => v.name))
    const rename = new Map<string, string>() // oldName → newName
    for (const s of suggestions) {
        if (s.i < 0 || s.i >= variables.length) continue
        const oldName = variables[s.i].name
        if (s.name === oldName) continue
        if (taken.has(s.name)) continue
        taken.delete(oldName)
        taken.add(s.name)
        rename.set(oldName, s.name)
        variables[s.i].name = s.name
    }
    if (rename.size === 0) return
    const walk = (node: unknown): void => {
        if (Array.isArray(node)) {
            for (let i = 0; i < node.length; i++) {
                const child = node[i]
                if (typeof child === 'string') {
                    node[i] = child.replace(/\{([a-z][a-z0-9_]*)\}/gi, (full, n: string) =>
                        rename.has(n) ? `{${rename.get(n)}}` : full,
                    )
                } else if (child && typeof child === 'object') walk(child)
            }
            return
        }
        if (!isPlainObject(node)) return
        for (const key of Object.keys(node)) {
            const v = node[key]
            if (typeof v === 'string') {
                node[key] = v.replace(/\{([a-z][a-z0-9_]*)\}/gi, (full, n: string) =>
                    rename.has(n) ? `{${rename.get(n)}}` : full,
                )
            } else if (v && typeof v === 'object') walk(v)
        }
    }
    walk(tree)
}
