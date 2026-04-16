// ─────────────────────────────────────────────────────────────
// KotoIQ Conversational Bot — floating overlay chat widget
// Click launcher → slide-in panel → chat with assistant →
// auto-fill / execute KotoIQ actions.
// ─────────────────────────────────────────────────────────────
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { MessageCircle, X, Minimize2, Send, Mic, Brain, Sparkles, ChevronRight, Loader, History, Plus, CheckCircle2, AlertCircle, Paperclip, Search, UserPlus } from 'lucide-react'
import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../../lib/theme'
import { supabase } from '../../lib/supabase'

const INTENT_PROGRESS_STEPS = {
  run_on_page_audit: ['Fetching page HTML', 'Analyzing headings', 'Checking meta tags', 'Scoring on-page signals', 'Finalizing report'],
  generate_brief: ['Researching competitors', 'Pulling SERP features', 'Drafting outline', 'Generating brief'],
  aeo_multi_engine: ['Querying ChatGPT', 'Querying Perplexity', 'Querying Gemini', 'Scoring visibility'],
  score_aeo: ['Querying ChatGPT', 'Querying Perplexity', 'Querying Gemini', 'Scoring visibility'],
  build_topical_map: ['Mapping entities', 'Finding clusters', 'Building hierarchy'],
  analyze_competitor: ['Crawling competitor site', 'Extracting topics', 'Mapping structure'],
  crawl_sitemap: ['Fetching sitemap', 'Parsing URLs', 'Categorizing pages'],
  check_plagiarism: ['Fetching content', 'Scanning the web', 'Scoring originality'],
  audit_eeat: ['Fetching page', 'Checking author signals', 'Scoring E-E-A-T'],
  analyze_backlinks: ['Pulling backlink profile', 'Scoring domains', 'Summarizing'],
  audit_schema: ['Fetching page', 'Parsing structured data', 'Validating schema'],
  scan_internal_links: ['Crawling pages', 'Mapping internal links', 'Finding gaps'],
  analyze_semantic_network: ['Extracting entities', 'Mapping relationships', 'Scoring network'],
  audit_technical_deep: ['Crawling site', 'Checking Core Web Vitals', 'Auditing technical SEO'],
  find_backlinks: ['Scanning niche', 'Finding linkable sites', 'Scoring opportunities'],
  analyze_reviews: ['Fetching reviews', 'Running sentiment analysis', 'Finding themes'],
  run_pipeline: ['Kicking off pipeline', 'Running full audit suite', 'Assembling report'],
  brand_serp_scan: ['Querying Google', 'Analyzing SERP', 'Scoring brand defense'],
  generate_schema: ['Fetching page', 'Extracting entities', 'Generating JSON-LD'],
  hyperlocal_content: ['Pulling grid scan', 'Drafting hyperlocal copy', 'Finalizing'],
  gsc_audit: ['Pulling GSC data', 'Analyzing queries', 'Summarizing'],
  bing_audit: ['Pulling Bing data', 'Analyzing', 'Summarizing'],
  build_content_calendar: ['Planning weeks', 'Assigning topics', 'Finalizing calendar'],
  content_refresh_plan: ['Inventorying pages', 'Scoring decay', 'Ranking refresh targets'],
  default: ['Starting', 'Running analysis', 'Finalizing'],
}

const SUGGESTED_PROMPTS = [
  { icon: Sparkles, label: 'Write me a blog post about...' },
  { icon: Sparkles, label: 'I want to rank for...' },
  { icon: Sparkles, label: 'Audit my homepage' },
  { icon: Sparkles, label: 'Find me backlink opportunities' },
  { icon: Sparkles, label: 'Build my topical map' },
  { icon: Sparkles, label: 'What should I work on this week?' },
]

const PANEL_WIDTH = 420

// Map intent → table + JSON path to the persisted row id. When missing or a
// look-up fails, we still log the activity row with NULL refs — revert is then
// disabled for that entry but the history is preserved.
const ACTION_RESULT_REFS = {
  generate_brief: { table: 'kotoiq_content_briefs', path: 'brief.id' },
  build_topical_map: { table: 'kotoiq_topical_maps', path: 'map.id' },
  run_on_page_audit: { table: 'kotoiq_on_page_audits', path: 'record_id' },
  generate_strategic_plan: { table: 'kotoiq_strategic_plans', path: 'plan_id' },
}

function resolvePath(obj, path) {
  if (!obj || !path) return null
  return path.split('.').reduce((a, k) => (a == null ? a : a[k]), obj)
}

export default function ConversationalBot({ clientId, clientName, agencyId, currentTab, onSwitchTab, onSwitchClient, clients, onRequestNewClient }) {
  const [open, setOpen] = useState(false)
  const [hasEverOpened, setHasEverOpened] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [messages, setMessages] = useState([]) // {role, content, action?, action_executed?, action_result?, error?, progressSteps?, progressIdx?}
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const [conversations, setConversations] = useState([])
  const [executing, setExecuting] = useState(null) // index of message being executed
  const [hasNewSuggestion, setHasNewSuggestion] = useState(false)
  const [pendingFile, setPendingFile] = useState(null) // File object queued to send
  const [uploadingFile, setUploadingFile] = useState(false)
  // When the user picks a client via pick_client, stash the original intent + fields here
  // so that once the client switch flushes through React we can resume the original request
  // without asking the LLM again. Shape: { intent, fields, clientId, fromMsgIdx }
  const [pendingResumption, setPendingResumption] = useState(null)
  const scrollRef = useRef(null)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640

  // Auto-scroll on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, thinking])

  // Auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'
  }, [input])

  // Load conversation list when toggling history
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list_bot_conversations', client_id: clientId, agency_id: agencyId, limit: 30 }),
      })
      const j = await res.json()
      setConversations(j.conversations || [])
    } catch {}
  }, [clientId, agencyId])

  useEffect(() => {
    if (showHistory) loadConversations()
  }, [showHistory, loadConversations])

  const loadConversation = async (id) => {
    try {
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_bot_conversation', conversation_id: id, client_id: clientId, agency_id: agencyId }),
      })
      const j = await res.json()
      if (j.error) return
      const msgs = (j.messages || []).map(m => ({
        role: m.role,
        content: m.content,
        action: m.action_data || null,
        action_executed: m.action_executed,
        action_result: m.action_result,
      }))
      setMessages(msgs)
      setConversationId(id)
      setShowHistory(false)
    } catch {}
  }

  // Upload a file to Supabase storage → return public URL
  const uploadAttachment = async (file, convId) => {
    const ts = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${agencyId || 'anon'}/${clientId || 'anon'}/${convId || 'new'}/${ts}-${safeName}`
    const { error } = await supabase.storage.from('kotoiq-bot-uploads').upload(path, file, { upsert: false })
    if (error) throw error
    const { data } = supabase.storage.from('kotoiq-bot-uploads').getPublicUrl(path)
    return data?.publicUrl
  }

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  const startNew = () => {
    setMessages([])
    setConversationId(null)
    setShowHistory(false)
  }

  const send = async (text) => {
    const trimmed = (text || input).trim()
    if ((!trimmed && !pendingFile) || thinking) return

    let attachmentUrl = null
    let attachmentName = null
    let attachmentSize = null
    if (pendingFile) {
      setUploadingFile(true)
      try {
        attachmentUrl = await uploadAttachment(pendingFile, conversationId)
        attachmentName = pendingFile.name
        attachmentSize = pendingFile.size
      } catch (e) {
        setUploadingFile(false)
        setMessages(m => [...m, { role: 'assistant', content: 'Attachment upload failed: ' + (e?.message || 'unknown'), error: true }])
        return
      }
      setUploadingFile(false)
    }

    const finalText = attachmentUrl
      ? `[attached: ${attachmentName} ${attachmentUrl}] ${trimmed}`.trim()
      : trimmed
    const displayText = attachmentUrl
      ? `${trimmed}\n\n[attached: ${attachmentName} (${formatSize(attachmentSize)})]`.trim()
      : trimmed

    const userMsg = { role: 'user', content: displayText }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setPendingFile(null)
    setThinking(true)
    setHasNewSuggestion(false)
    try {
      const history = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run_conversational_bot',
          client_id: clientId,
          agency_id: agencyId,
          conversation_id: conversationId,
          message: finalText,
          conversation_history: history,
          current_tab: currentTab,
        }),
      })
      const j = await res.json()
      if (j.error) {
        setMessages(m => [...m, { role: 'assistant', content: 'Hmm, I hit an error: ' + j.error, error: true }])
      } else {
        setConversationId(j.conversation_id || conversationId)
        setMessages(m => {
          const next = [...m, { role: 'assistant', content: j.message || '...', action: j.action || null, choices: Array.isArray(j.choices) && j.choices.length ? j.choices : null }]
          // Auto-execute should_execute actions — fire after state updates so indexes are stable
          if (j.action && j.action.should_execute) {
            const newIdx = next.length - 1
            setTimeout(() => autoRunAction(newIdx, j.action), 0)
          }
          return next
        })
        if (j.action) setHasNewSuggestion(true)
      }
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: 'Network error. Please try again.', error: true }])
    } finally {
      setThinking(false)
    }
  }

  const autoRunAction = (idx, action) => {
    runAction(idx, true, action)
  }

  // Click a choice chip → mark the chips on that message as used, then send the
  // chosen string as if the user typed it.
  const handleChoiceClick = (msgIdx, choice) => {
    if (thinking) return
    setMessages(m => m.map((x, i) => i === msgIdx ? { ...x, choices_used: true } : x))
    send(choice)
  }

  // ── Client picker handlers ──────────────────────────────────────────────
  // Called from the in-card picker when the user chooses an existing client.
  // Sets the active client, marks the pick_client action as executed, and
  // stashes the original intent/fields so the post-switch effect can resume.
  const handlePickExistingClient = (msgIdx, client, originalIntent, originalFields) => {
    if (!client?.id) return
    setMessages(m => m.map((x, i) => i === msgIdx ? {
      ...x,
      action_executed: true,
      action_result: { ok: true, summary: `Using ${client.name}.` },
    } : x))
    setMessages(m => [...m, { role: 'system_note', content: `Switched to ${client.name}` }])
    if (onSwitchClient) onSwitchClient(client.id)
    // Resume the original intent, if any. Wait for React to commit the client switch first.
    if (originalIntent) {
      setPendingResumption({
        intent: originalIntent,
        fields: originalFields || {},
        clientId: client.id,
        fromMsgIdx: msgIdx,
      })
    }
  }

  // Called when the user hits "+ New Client". We defer to the host page's
  // modal (onRequestNewClient) and then wait for the clients list to include
  // a fresh entry whose id was not in the list before the modal opened.
  const handleCreateNewClient = (msgIdx, originalIntent, originalFields) => {
    if (!onRequestNewClient) return
    const existingIds = new Set((clients || []).map(c => c.id))
    // Stash the resumption info; the watch effect below picks up the new client id.
    setPendingResumption({
      awaitingNewClient: true,
      existingIds,
      intent: originalIntent,
      fields: originalFields || {},
      fromMsgIdx: msgIdx,
    })
    onRequestNewClient()
  }

  // When awaitingNewClient is true and a new client appears in the clients list,
  // activate it and resume the original intent.
  useEffect(() => {
    if (!pendingResumption?.awaitingNewClient) return
    const fresh = (clients || []).find(c => !pendingResumption.existingIds.has(c.id))
    if (!fresh) return
    if (onSwitchClient) onSwitchClient(fresh.id)
    setMessages(m => [...m, { role: 'system_note', content: `New client added: ${fresh.name}` }])
    setPendingResumption({
      intent: pendingResumption.intent,
      fields: pendingResumption.fields,
      clientId: fresh.id,
      fromMsgIdx: pendingResumption.fromMsgIdx,
    })
  }, [clients, pendingResumption, onSwitchClient])

  // When clientId matches a pending resumption, synthesize the real action and run it.
  useEffect(() => {
    if (!pendingResumption || pendingResumption.awaitingNewClient) return
    if (!pendingResumption.intent) { setPendingResumption(null); return }
    if (clientId !== pendingResumption.clientId) return
    const intent = pendingResumption.intent
    const fields = pendingResumption.fields || {}
    const tabKey = INTENT_TO_TAB[intent] || intent
    const hasApi = INTENT_TO_API[intent] !== undefined && INTENT_TO_API[intent] !== null
    const action = {
      intent,
      tab_to_open: tabKey,
      form_fields: fields,
      should_execute: hasApi,
      client_id: null,
    }
    const assistantMsg = { role: 'assistant', content: `OK, using ${(clients || []).find(c => c.id === clientId)?.name || 'this client'}.`, action }
    setPendingResumption(null)
    setMessages(m => {
      const next = [...m, assistantMsg]
      const newIdx = next.length - 1
      if (hasApi) setTimeout(() => autoRunAction(newIdx, action), 0)
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, pendingResumption])

  // Progressively reveal form_fields into the active tab — one character at a time
  // across fields — so the user sees the bot "typing" into the form. Budget capped
  // so nothing ever takes longer than ~2s total.
  const liveFillFields = async (tabKey, fields) => {
    if (!onSwitchTab) return
    const entries = Object.entries(fields || {}).filter(([, v]) => v !== undefined && v !== null)
    if (!entries.length) return
    // Strings get typed; non-strings are applied whole.
    const totalChars = entries.reduce((n, [, v]) => n + (typeof v === 'string' ? v.length : 1), 0)
    const BUDGET_MS = 1800
    const perCharMs = Math.max(8, Math.min(40, Math.floor(BUDGET_MS / Math.max(totalChars, 1))))
    const partial = {}
    for (const [key, value] of entries) {
      if (typeof value === 'string') {
        for (let i = 1; i <= value.length; i++) {
          partial[key] = value.slice(0, i)
          onSwitchTab(tabKey, { ...partial })
          // eslint-disable-next-line no-await-in-loop
          await new Promise(r => setTimeout(r, perCharMs))
        }
      } else {
        partial[key] = value
        onSwitchTab(tabKey, { ...partial })
        // eslint-disable-next-line no-await-in-loop
        await new Promise(r => setTimeout(r, 60))
      }
    }
  }

  // Run the proposed action: switch client (if needed) → switch tab → progressively fill
  // the form character-by-character so the user sees the bot "typing" in → optionally execute.
  // Accepts an explicit action for auto-run from within send() where state hasn't flushed yet.
  const runAction = async (msgIdx, executeNow, explicitAction) => {
    const resolvedAction = explicitAction || messages[msgIdx]?.action
    if (!resolvedAction) return
    const { intent, tab_to_open, form_fields, should_execute, client_id: actionClientId } = resolvedAction

    // pick_client is handled entirely in-UI (ActionCard renders the picker).
    // Never auto-switch tabs, never hit the API. Just mark the action as waiting.
    if (intent === 'pick_client') {
      setMessages(m => m.map((x, i) => i === msgIdx ? { ...x, action_executed: false } : x))
      return
    }

    // Client-side correctness safety net — mirrors the server-side guard in the engine.
    // If the action has no client_id and there's no active client, DO NOT call the API.
    // This catches cases where the LLM ignored rule #8 and tried to execute anyway.
    const resolvedClientId = actionClientId || clientId
    if (!resolvedClientId && intent !== 'pick_client') {
      setMessages(m => m.map((x, i) => i === msgIdx ? {
        ...x,
        action_executed: true,
        action_result: { ok: false, summary: 'No client selected — please pick or create one first.' },
      } : x))
      setMessages(m => [...m, {
        role: 'assistant',
        content: 'I need a client to run this on. Which client is this for?',
        action: {
          intent: 'pick_client',
          tab_to_open: 'picker',
          form_fields: {
            suggestions: [],
            original_intent: intent,
            original_fields: form_fields || {},
            prompt: 'Pick a client to continue',
          },
          should_execute: false,
          client_id: null,
        },
      }])
      return
    }

    // If the action targets a different client, switch first and give React a moment to commit
    if (actionClientId && actionClientId !== clientId && onSwitchClient) {
      const target = (clients || []).find(c => c.id === actionClientId)
      if (target) {
        setMessages(m => [...m, { role: 'system_note', content: `Switching to ${target.name}…` }])
      }
      onSwitchClient(actionClientId)
      await new Promise(r => setTimeout(r, 220))
    }

    // Open the tab immediately with empty fields so the blank form is visible...
    if (onSwitchTab) onSwitchTab(tab_to_open, {})
    // ...then progressively reveal the fields, character-by-character.
    await liveFillFields(tab_to_open, form_fields || {})

    if (!executeNow || !should_execute) {
      setMessages(m => m.map((x, i) => i === msgIdx ? { ...x, action_executed: true, action_result: { mode: 'prefill' } } : x))
      return
    }
    setExecuting(msgIdx)
    const steps = INTENT_PROGRESS_STEPS[intent] || INTENT_PROGRESS_STEPS.default
    setMessages(m => m.map((x, i) => i === msgIdx ? { ...x, progressSteps: steps, progressIdx: 0 } : x))
    const tick = setInterval(() => {
      setMessages(m => m.map((x, i) => {
        if (i !== msgIdx) return x
        const cur = x.progressIdx ?? 0
        const next = Math.min(cur + 1, steps.length - 1)
        return { ...x, progressIdx: next }
      }))
    }, 800)
    try {
      const apiAction = INTENT_TO_API[intent]
      if (!apiAction) {
        clearInterval(tick)
        setMessages(m => [...m, { role: 'assistant', content: `Switched to ${tab_to_open}. Form is pre-filled — review and run when ready.` }])
        setMessages(m => m.map((x, i) => i === msgIdx ? { ...x, action_executed: true, action_result: { mode: 'prefill' }, progressSteps: undefined, progressIdx: undefined } : x))
        return
      }
      const effectiveClientId = actionClientId || clientId
      const res = await fetch('/api/kotoiq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: apiAction, client_id: effectiveClientId, agency_id: agencyId, ...form_fields }),
      })
      const j = await res.json()
      clearInterval(tick)
      const ok = res.ok && !j.error
      setMessages(m => m.map((x, i) => i === msgIdx ? { ...x, action_executed: true, action_result: { ok, summary: j.error || summarizeResult(j) }, progressSteps: undefined, progressIdx: undefined } : x))
      if (ok && effectiveClientId && agencyId) {
        const ref = ACTION_RESULT_REFS[intent]
        const refId = ref ? resolvePath(j, ref.path) : null
        fetch('/api/kotoiq', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'log_client_activity',
            client_id: effectiveClientId,
            agency_id: agencyId,
            bot_conversation_id: conversationId,
            intent,
            action_api: apiAction,
            inputs: form_fields || {},
            result: { summary: summarizeResult(j) },
            result_ref_table: refId ? ref.table : null,
            result_ref_id: refId || null,
          }),
        }).catch(() => {})
      }
      setMessages(m => [...m, {
        role: 'assistant',
        content: ok
          ? `Done. ${summarizeResult(j)} I logged this to activity — open the Activity tab to view history or revert.`
          : `That run failed: ${j.error || 'unknown error'}. Want me to try something else?`,
        ...(ok ? { viewActivity: true } : {}),
      }])
    } catch (e) {
      clearInterval(tick)
      setMessages(m => m.map((x, i) => i === msgIdx ? { ...x, action_executed: true, action_result: { ok: false, summary: e?.message || 'error' }, progressSteps: undefined, progressIdx: undefined } : x))
    } finally {
      setExecuting(null)
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const openPanel = () => { setOpen(true); setHasEverOpened(true) }
  const collapsePanel = () => { setOpen(false); setHasEverOpened(true) }

  // ── Render ──────────────────────────────────────────────────────────────
  if (!open) {
    // Before user has ever opened → show big circular launcher (bottom-right)
    if (!hasEverOpened) {
      return (
        <button
          onClick={openPanel}
          title="KotoIQ Assistant"
          style={{
            position: 'fixed', bottom: 24, right: 24, width: 56, height: 56, borderRadius: '50%',
            background: T, color: '#fff', border: 'none', cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(0,194,203,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, transition: 'transform .15s', animation: hasNewSuggestion ? 'kotoiqBotPulse 1.6s infinite' : 'none',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.06)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <MessageCircle size={26} />
          <style>{`@keyframes kotoiqBotPulse { 0%,100% { box-shadow: 0 6px 20px rgba(0,194,203,0.45); } 50% { box-shadow: 0 6px 30px rgba(0,194,203,0.85); } }`}</style>
        </button>
      )
    }
    // After opening once → collapse to a thin vertical side-tab on the right
    return (
      <button
        onClick={openPanel}
        title="KotoIQ Assistant"
        style={{
          position: 'fixed', top: '50%', right: 0, transform: 'translateY(-50%)',
          width: 44, height: '80vh', borderTopLeftRadius: 12, borderBottomLeftRadius: 12,
          background: BLK, color: '#fff', border: 'none', borderRight: 'none', cursor: 'pointer',
          boxShadow: '-4px 0 14px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px 0',
          zIndex: 9999,
          animation: hasNewSuggestion ? 'kotoiqSidePulse 1.6s infinite' : 'none',
        }}
      >
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: T, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Brain size={16} color="#fff" />
        </div>
        <div style={{
          writingMode: 'vertical-rl', transform: 'rotate(180deg)',
          fontFamily: FH, fontSize: 12, fontWeight: 700, letterSpacing: 1.2,
        }}>
          {clientName ? `KotoIQ · ${clientName}` : 'KotoIQ'}
        </div>
        <style>{`@keyframes kotoiqSidePulse { 0%,100% { box-shadow: -4px 0 14px rgba(0,0,0,0.18); } 50% { box-shadow: -4px 0 22px rgba(0,194,203,0.75); } }`}</style>
      </button>
    )
  }

  const panelStyle = isMobile
    ? { position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 9999 }
    : { position: 'fixed', bottom: 24, right: 24, width: PANEL_WIDTH, height: 'min(640px, calc(100vh - 48px))', zIndex: 9999, borderRadius: 16, overflow: 'hidden' }

  return (
    <div style={{ ...panelStyle, background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 20px 50px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 10, background: BLK, color: '#fff' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: T, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Brain size={18} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: FH }}>KotoIQ Assistant</div>
          <div style={{ fontSize: 11, opacity: 0.75, fontFamily: FB, display: 'flex', alignItems: 'center', gap: 4 }}>
            {thinking ? 'Thinking…' : clientName ? <>Working on <span style={{ color: T, fontWeight: 700 }}>{clientName}</span></> : 'No client selected'}
          </div>
        </div>
        <button onClick={startNew} title="New conversation"
          style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 4, opacity: 0.7 }}>
          <Plus size={18} />
        </button>
        <button onClick={() => setShowHistory(s => !s)} title="History"
          style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 4, opacity: 0.7 }}>
          <History size={18} />
        </button>
        <button onClick={collapsePanel} title="Minimize to side"
          style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 4, opacity: 0.7 }}>
          <Minimize2 size={18} />
        </button>
        <button onClick={collapsePanel} title="Close to side"
          style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 4, opacity: 0.7 }}>
          <X size={18} />
        </button>
      </div>

      {showHistory ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, padding: '4px 8px', fontFamily: FH }}>Past Conversations</div>
          {conversations.length === 0 && (
            <div style={{ padding: 16, color: '#9ca3af', fontSize: 13, textAlign: 'center', fontFamily: FB }}>No conversations yet.</div>
          )}
          {conversations.map(c => (
            <button key={c.id} onClick={() => loadConversation(c.id)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: 10, border: 'none', background: 'transparent', borderRadius: 8, cursor: 'pointer', fontFamily: FB }}
              onMouseEnter={e => e.currentTarget.style.background = GRY}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ fontSize: 13, color: BLK, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title || 'Untitled'}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{c.last_message_at ? new Date(c.last_message_at).toLocaleString() : ''}</div>
            </button>
          ))}
        </div>
      ) : (
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, background: GRY }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 8px' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: T, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Brain size={32} color="#fff" />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: BLK, fontFamily: FH }}>
                {clientName ? <>Hi! Let's work on <span style={{ color: T }}>{clientName}</span>.</> : 'Hi! Tell me what you want to do.'}
              </div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4, fontFamily: FB }}>I can write briefs, audit pages, build topical maps, find backlinks — just describe it.</div>
              <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SUGGESTED_PROMPTS.map(p => (
                  <button key={p.label} onClick={() => send(p.label)}
                    style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: 13, color: BLK, fontFamily: FB, display: 'flex', alignItems: 'center', gap: 10, transition: 'all .12s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = T; e.currentTarget.style.background = '#f0fdfe' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = '#fff' }}>
                    <p.icon size={14} color={T} />
                    <span style={{ flex: 1 }}>{p.label}</span>
                    <ChevronRight size={14} color="#9ca3af" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            m.role === 'system_note'
              ? <SystemNote key={i} text={m.content} />
              : <MessageBubble
                  key={i}
                  msg={m}
                  idx={i}
                  onRun={runAction}
                  executing={executing === i}
                  onViewActivity={onSwitchTab ? () => onSwitchTab('activity', {}) : null}
                  clients={clients}
                  onPickClient={handlePickExistingClient}
                  onCreateNewClient={handleCreateNewClient}
                  onChoiceClick={handleChoiceClick}
                  thinking={thinking}
                />
          ))}

          {thinking && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: T, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Brain size={15} color="#fff" />
              </div>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '10px 14px' }}>
                <span style={{ display: 'inline-flex', gap: 4 }}>
                  <Dot delay={0} /><Dot delay={0.15} /><Dot delay={0.3} />
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input bar */}
      {!showHistory && (
        <div style={{ padding: 12, borderTop: '1px solid #e5e7eb', background: '#fff' }}>
          {pendingFile && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#f0fdfe', border: `1px solid ${T}`, borderRadius: 8, marginBottom: 8, fontSize: 12, fontFamily: FB, color: BLK, maxWidth: '100%' }}>
              <Paperclip size={12} color={T} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{pendingFile.name}</span>
              <span style={{ color: '#6b7280' }}>{formatSize(pendingFile.size)}</span>
              {uploadingFile && <Loader size={12} className="kotoiq-bot-spin" />}
              <button onClick={() => setPendingFile(null)} disabled={uploadingFile}
                style={{ background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 0, display: 'flex' }}>
                <X size={14} />
              </button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf,text/csv,text/plain,.csv,.txt"
              style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) setPendingFile(f)
                e.target.value = ''
              }}
            />
            <button title="Attach file" onClick={() => fileInputRef.current?.click()} disabled={thinking || uploadingFile}
              style={{ background: '#f3f4f6', color: BLK, border: 'none', borderRadius: 10, padding: 10, cursor: thinking || uploadingFile ? 'not-allowed' : 'pointer' }}>
              <Paperclip size={18} />
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Describe what you want to do…"
              rows={1}
              style={{ flex: 1, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, fontFamily: FB, color: BLK, resize: 'none', outline: 'none', maxHeight: 140, lineHeight: 1.4 }}
              onFocus={e => e.currentTarget.style.borderColor = T}
              onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}
            />
            <button title="Voice (coming soon)" disabled
              style={{ background: '#f3f4f6', color: '#9ca3af', border: 'none', borderRadius: 10, padding: 10, cursor: 'not-allowed' }}>
              <Mic size={18} />
            </button>
            <button onClick={() => send()} disabled={thinking || uploadingFile || (!input.trim() && !pendingFile)}
              style={{ background: (input.trim() || pendingFile) && !thinking && !uploadingFile ? T : '#e5e7eb', color: '#fff', border: 'none', borderRadius: 10, padding: 10, cursor: (input.trim() || pendingFile) && !thinking && !uploadingFile ? 'pointer' : 'not-allowed' }}>
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
      <style>{`@keyframes kotoiqBotFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  )
}

// ── Message bubble subcomponent ───────────────────────────────────────────
function MessageBubble({ msg, idx, onRun, executing, onViewActivity, clients, onPickClient, onCreateNewClient, onChoiceClick, thinking }) {
  const isUser = msg.role === 'user'
  const hasChoices = !isUser && Array.isArray(msg.choices) && msg.choices.length > 0
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexDirection: isUser ? 'row-reverse' : 'row', animation: 'kotoiqBotFadeIn .25s ease' }}>
      {!isUser && (
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: T, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Brain size={15} color="#fff" />
        </div>
      )}
      <div style={{ maxWidth: '80%' }}>
        <div style={{
          background: isUser ? T : (msg.error ? '#fee2e2' : '#fff'),
          color: isUser ? '#fff' : (msg.error ? '#991b1b' : BLK),
          border: isUser ? 'none' : `1px solid ${msg.error ? '#fecaca' : '#e5e7eb'}`,
          borderRadius: 14,
          padding: '10px 14px',
          fontSize: 13.5,
          lineHeight: 1.5,
          fontFamily: FB,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {msg.content}
        </div>
        {hasChoices && (
          <ChoiceChips
            choices={msg.choices}
            disabled={msg.choices_used || thinking}
            onClick={(choice) => onChoiceClick?.(idx, choice)}
          />
        )}
        {msg.action && !isUser && (
          <ActionCard
            action={msg.action}
            idx={idx}
            onRun={onRun}
            executing={executing}
            executed={msg.action_executed}
            result={msg.action_result}
            progressSteps={msg.progressSteps}
            progressIdx={msg.progressIdx}
            clients={clients}
            onPickClient={onPickClient}
            onCreateNewClient={onCreateNewClient}
          />
        )}
        {msg.viewActivity && !isUser && onViewActivity && (
          <button onClick={onViewActivity}
            style={{ marginTop: 6, padding: '6px 10px', background: '#fff', color: T, border: `1px solid ${T}`, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FH, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <History size={12} /> View activity
          </button>
        )}
      </div>
    </div>
  )
}

// ── Choice chips — compact clickable buttons for multiple-choice prompts ──
function ChoiceChips({ choices, disabled, onClick }) {
  return (
    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {choices.map((choice, i) => (
        <button
          key={`${i}-${choice}`}
          type="button"
          onClick={() => !disabled && onClick?.(choice)}
          disabled={disabled}
          style={{
            padding: '6px 12px',
            borderRadius: 999,
            border: `1px solid ${disabled ? '#e5e7eb' : '#e5e7eb'}`,
            background: '#fff',
            color: disabled ? '#9ca3af' : BLK,
            fontSize: 12.5,
            fontWeight: 600,
            fontFamily: FB,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.55 : 1,
            transition: 'all .12s',
            lineHeight: 1.2,
          }}
          onMouseEnter={e => {
            if (disabled) return
            e.currentTarget.style.borderColor = T
            e.currentTarget.style.background = '#f0fdfe'
          }}
          onMouseLeave={e => {
            if (disabled) return
            e.currentTarget.style.borderColor = '#e5e7eb'
            e.currentTarget.style.background = '#fff'
          }}
        >
          {choice}
        </button>
      ))}
    </div>
  )
}

// ── Action proposal card ──────────────────────────────────────────────────
function ActionCard({ action, idx, onRun, executing, executed, result, progressSteps, progressIdx, clients, onPickClient, onCreateNewClient }) {
  const fields = action.form_fields || {}
  const fieldKeys = Object.keys(fields)
  const showProgress = executing && Array.isArray(progressSteps) && progressSteps.length > 0
  const curStep = showProgress ? Math.min(progressIdx ?? 0, progressSteps.length - 1) : -1
  const isPicker = action.intent === 'pick_client'

  // pick_client renders a specialised inline picker — no form-fields table, no run button.
  if (isPicker) {
    return (
      <div style={{ marginTop: 8, border: `1px solid ${T}`, borderRadius: 12, background: '#f0fdfe', padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <UserPlus size={14} color={T} />
          <div style={{ fontSize: 12, fontWeight: 700, color: BLK, fontFamily: FH, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Pick A Client
          </div>
        </div>
        {executed ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: result?.ok === false ? '#991b1b' : GRN, fontFamily: FB }}>
            {result?.ok === false ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
            <span>{result?.summary || 'Selected'}</span>
          </div>
        ) : (
          <ClientPicker
            suggestions={Array.isArray(fields.suggestions) ? fields.suggestions : []}
            clients={clients || []}
            onPick={(client) => onPickClient?.(idx, client, fields.original_intent, fields.original_fields)}
            onNew={() => onCreateNewClient?.(idx, fields.original_intent, fields.original_fields)}
          />
        )}
      </div>
    )
  }

  return (
    <div style={{ marginTop: 8, border: `1px solid ${T}`, borderRadius: 12, background: '#f0fdfe', padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Sparkles size={14} color={T} />
        <div style={{ fontSize: 12, fontWeight: 700, color: BLK, fontFamily: FH, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {prettyIntent(action.intent)}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 10, color: '#6b7280', background: '#fff', padding: '2px 6px', borderRadius: 4 }}>
          → {action.tab_to_open}
        </div>
      </div>
      {fieldKeys.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 8, padding: 8, marginBottom: 10 }}>
          {fieldKeys.map(k => (
            <div key={k} style={{ display: 'flex', fontSize: 12, padding: '3px 0', fontFamily: FB }}>
              <span style={{ color: '#6b7280', minWidth: 90, fontWeight: 600 }}>{k}:</span>
              <span style={{ color: BLK, flex: 1, wordBreak: 'break-word' }}>{String(fields[k])}</span>
            </div>
          ))}
        </div>
      )}
      {showProgress && (
        <div style={{ background: '#fff', borderRadius: 8, padding: 10, marginBottom: 10 }}>
          {progressSteps.map((step, i) => {
            const done = i < curStep
            const active = i === curStep
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontFamily: FB, padding: '3px 0', color: done ? GRN : active ? BLK : '#9ca3af' }}>
                {done ? (
                  <CheckCircle2 size={13} color={GRN} />
                ) : active ? (
                  <span style={{ width: 13, height: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: T, animation: 'kotoiqBotStepPulse 1s infinite' }} />
                  </span>
                ) : (
                  <span style={{ width: 13, height: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#d1d5db' }} />
                  </span>
                )}
                <span style={{ fontWeight: active ? 600 : 400 }}>{step}</span>
              </div>
            )
          })}
          <style>{`@keyframes kotoiqBotStepPulse { 0%,100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 1; transform: scale(1.25); } }`}</style>
        </div>
      )}
      {executed ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: result?.ok === false ? '#991b1b' : GRN, fontFamily: FB }}>
          {result?.ok === false ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
          <span>{result?.ok === false ? 'Failed' : (result?.mode === 'prefill' ? 'Form pre-filled — opened the tab' : 'Run complete')}</span>
        </div>
      ) : executing ? null : (
        <div style={{ display: 'flex', gap: 6 }}>
          {action.should_execute ? (
            <button onClick={() => onRun(idx, true)} disabled={executing}
              style={{ flex: 1, padding: '8px 12px', background: T, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: executing ? 'wait' : 'pointer', fontFamily: FH, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {executing ? <><Loader size={14} className="kotoiq-bot-spin" /> Running…</> : <>Run This</>}
            </button>
          ) : null}
          <button onClick={() => onRun(idx, false)} disabled={executing}
            style={{ flex: action.should_execute ? 'none' : 1, padding: '8px 12px', background: '#fff', color: BLK, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: executing ? 'wait' : 'pointer', fontFamily: FH }}>
            {action.should_execute ? 'Modify First' : 'Open Form'}
          </button>
        </div>
      )}
      {action.next_question && !executed && !executing && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280', fontStyle: 'italic', fontFamily: FB }}>
          {action.next_question}
        </div>
      )}
      <style>{`.kotoiq-bot-spin { animation: kotoiqBotSpin 1s linear infinite; } @keyframes kotoiqBotSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Client picker (inline inside pick_client ActionCard) ──────────────────
function ClientPicker({ suggestions, clients, onPick, onNew }) {
  const [query, setQuery] = useState('')
  const safeClients = Array.isArray(clients) ? clients : []
  const suggestionRows = useMemo(() => {
    const byId = new Map(safeClients.map(c => [c.id, c]))
    return (suggestions || [])
      .map(s => {
        const c = byId.get(s.id)
        if (!c) return null
        return { ...c, reason: s.reason || null }
      })
      .filter(Boolean)
  }, [suggestions, safeClients])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return safeClients.slice(0, 8)
    return safeClients
      .filter(c => {
        const hay = [c.name, c.website, c.primary_service].filter(Boolean).join(' ').toLowerCase()
        return hay.includes(q)
      })
      .slice(0, 20)
  }, [query, safeClients])
  const suggestedIds = new Set(suggestionRows.map(r => r.id))
  return (
    <div>
      {suggestionRows.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 8, padding: 8, marginBottom: 8, border: `1px dashed ${T}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6, fontFamily: FH }}>
            Suggested
          </div>
          {suggestionRows.map(c => (
            <button key={c.id} onClick={() => onPick(c)} type="button"
              style={{ display: 'flex', width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', borderRadius: 8, background: 'transparent', cursor: 'pointer', gap: 8, alignItems: 'center', fontFamily: FB }}
              onMouseEnter={e => e.currentTarget.style.background = '#f0fdfe'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: BLK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.name}
                </div>
                {c.reason && (
                  <div style={{ fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.reason}
                  </div>
                )}
              </div>
              <ChevronRight size={14} color="#9ca3af" />
            </button>
          ))}
        </div>
      )}
      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>
          <Search size={13} color="#9ca3af" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search clients…"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, fontFamily: FB, color: BLK, background: 'transparent' }}
          />
        </div>
        <div style={{ maxHeight: 180, overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <div style={{ padding: 10, fontSize: 12, color: '#9ca3af', fontFamily: FB, textAlign: 'center' }}>
              {safeClients.length === 0 ? 'No clients yet.' : 'No matches.'}
            </div>
          )}
          {filtered.map(c => (
            <button key={c.id} onClick={() => onPick(c)} type="button"
              style={{ display: 'flex', width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', background: suggestedIds.has(c.id) ? '#f0fdfe' : 'transparent', cursor: 'pointer', gap: 8, alignItems: 'center', fontFamily: FB, borderBottom: '1px solid #f9fafb' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
              onMouseLeave={e => e.currentTarget.style.background = suggestedIds.has(c.id) ? '#f0fdfe' : 'transparent'}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: BLK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.name}
                </div>
                {c.website && (
                  <div style={{ fontSize: 11, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.website}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
        <button onClick={onNew} type="button"
          style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '10px 12px', border: 'none', borderTop: '1px solid #e5e7eb', background: '#fafafa', cursor: 'pointer', fontFamily: FH, fontSize: 12, fontWeight: 700, color: T }}
          onMouseEnter={e => e.currentTarget.style.background = '#f0fdfe'}
          onMouseLeave={e => e.currentTarget.style.background = '#fafafa'}>
          <Plus size={14} /> New Client
        </button>
      </div>
    </div>
  )
}

function SystemNote({ text }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0', animation: 'kotoiqBotFadeIn .25s ease' }}>
      <div style={{
        fontSize: 11, fontFamily: FB, color: '#6b7280', background: '#eef2ff',
        border: '1px solid #dbeafe', borderRadius: 999, padding: '4px 10px',
      }}>
        {text}
      </div>
    </div>
  )
}

function Dot({ delay }) {
  return (
    <span style={{
      width: 6, height: 6, borderRadius: '50%', background: '#9ca3af',
      animation: `kotoiqBotBounce 1.2s ${delay}s infinite`,
      display: 'inline-block',
    }}>
      <style>{`@keyframes kotoiqBotBounce { 0%,80%,100% { opacity: 0.3; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-4px); } }`}</style>
    </span>
  )
}

function prettyIntent(s) {
  return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function summarizeResult(j) {
  if (!j || typeof j !== 'object') return ''
  if (j.brief?.title) return `Brief generated: ${j.brief.title}.`
  if (j.audit?.score != null) return `Score: ${j.audit.score}.`
  if (j.aeo_score != null) return `AEO score: ${j.aeo_score}.`
  if (Array.isArray(j.opportunities)) return `${j.opportunities.length} opportunities found.`
  if (Array.isArray(j.urls)) return `${j.urls.length} URLs found.`
  if (j.message) return j.message
  return 'See the tab for full results.'
}

// Map intent → tab key (mirrors the mapping in the engine's SYSTEM_PROMPT). Used by
// the resumption effect after a pick_client so we know which tab to open.
const INTENT_TO_TAB = {
  generate_brief: 'briefs',
  run_on_page_audit: 'on_page',
  score_aeo: 'aeo',
  aeo_multi_engine: 'aeo',
  build_topical_map: 'topical_map',
  check_plagiarism: 'plagiarism',
  analyze_competitor: 'competitor_map',
  geo_tag_image: 'gmb_images',
  crawl_sitemap: 'sitemap_crawler',
  generate_strategic_plan: 'strategy',
  audit_eeat: 'eeat',
  find_backlinks: 'backlink_opps',
  analyze_reviews: 'reviews',
  run_pipeline: 'autopilot',
  analyze_backlinks: 'backlinks',
  audit_schema: 'schema',
  scan_internal_links: 'internal_links',
  analyze_query_paths: 'query_path',
  analyze_semantic_network: 'semantic',
  audit_technical_deep: 'technical_deep',
  build_content_calendar: 'calendar',
  content_refresh_plan: 'content_refresh',
  run_rank_grid: 'rankgrid',
  gsc_audit: 'gsc_audit',
  bing_audit: 'bing_audit',
  brand_serp_scan: 'brand_serp',
  generate_schema: 'schema',
  knowledge_graph_export: 'knowledge_graph',
  hyperlocal_content: 'hyperlocal',
  watermark_remove: 'watermark',
  upwork_checklist: 'upwork',
  passage_optimize: 'passage',
  context_align: 'context_aligner',
  topical_authority: 'topical_authority',
  content_decay: 'content_decay',
  ask_kotoiq: 'ask',
  competitor_watch: 'competitor_watch',
  bulk_operation: 'bulk',
}

// Map intent → existing API action name
const INTENT_TO_API = {
  generate_brief: 'generate_brief',
  run_on_page_audit: 'analyze_on_page',
  score_aeo: 'aeo_deep_analysis',
  aeo_multi_engine: 'aeo_deep_analysis',
  build_topical_map: 'generate_topical_map',
  check_plagiarism: 'check_plagiarism',
  analyze_competitor: 'extract_competitor_topical_map',
  crawl_sitemap: 'crawl_sitemaps',
  audit_eeat: 'audit_eeat',
  find_backlinks: 'scan_backlink_opportunities',
  analyze_reviews: 'analyze_reviews',
  run_pipeline: 'run_autonomous_pipeline',
  analyze_backlinks: 'analyze_backlinks',
  audit_schema: 'audit_schema',
  scan_internal_links: 'scan_internal_links',
  analyze_query_paths: 'analyze_query_paths',
  analyze_semantic_network: 'analyze_semantic_network',
  audit_technical_deep: 'audit_technical_deep',
  build_content_calendar: 'build_content_calendar',
  content_refresh_plan: 'build_content_inventory',
  gsc_audit: 'gsc_audit',
  bing_audit: 'bing_audit',
  brand_serp_scan: 'scan_brand_serp',
  generate_schema: 'generate_schema_for_url',
  hyperlocal_content: 'generate_hyperlocal',
  // intents below open a tab without auto-running (need extra UI choices)
  geo_tag_image: null,
  generate_strategic_plan: null,
  run_rank_grid: null,
  knowledge_graph_export: null,
  watermark_remove: null,
  upwork_checklist: null,
  passage_optimize: null,
  context_align: null,
  topical_authority: null,
  content_decay: null,
  ask_kotoiq: null,
  competitor_watch: null,
  bulk_operation: null,
}
