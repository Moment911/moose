"use client"

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { R, T, BLK, GRN, AMB, W, FH, FB } from '../lib/theme'
import PublicNav from '../components/public/PublicNav'
import PublicFooter from '../components/public/PublicFooter'
import { usePageMeta } from '../lib/usePageMeta'

const INK    = BLK
const MUTED  = '#6b7280'
const FAINT  = '#9ca3af'
const HAIR   = '#e5e7eb'
const SURFACE= '#f9fafb'

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { background: ${W}; color: ${INK}; font-family: ${FH}; -webkit-font-smoothing: antialiased; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  .fade { animation: fadeUp .6s ease both; }
  .fade-1 { animation-delay: .05s; }
  .fade-2 { animation-delay: .12s; }
  .fade-3 { animation-delay: .2s; }
  .btn { display: inline-flex; align-items: center; gap: 8px; border-radius: 10px; cursor: pointer; font-family: ${FH}; font-weight: 700; transition: all .18s; border: 1px solid transparent; }
  .btn-primary { background: ${INK}; color: ${W}; padding: 15px 28px; font-size: 15px; }
  .btn-primary:hover { background: #000; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(17,17,17,.18); }
  .btn-secondary { background: ${W}; color: ${INK}; border-color: ${HAIR}; padding: 15px 28px; font-size: 15px; }
  .btn-secondary:hover { border-color: ${INK}; transform: translateY(-1px); }
  .agent-card { background: ${W}; border: 1px solid ${HAIR}; border-radius: 14px; padding: 24px 26px; transition: border-color .2s, transform .2s, box-shadow .2s; }
  .agent-card:hover { border-color: ${INK}; transform: translateY(-2px); box-shadow: 0 12px 32px rgba(17,17,17,.06); }
  .pill { cursor: pointer; padding: 8px 16px; border-radius: 100px; font-size: 13px; font-weight: 700; border: 1px solid ${HAIR}; background: ${W}; color: ${MUTED}; transition: all .15s; font-family: ${FH}; }
  .pill:hover { border-color: ${INK}; color: ${INK}; }
  .pill.active { background: ${INK}; color: ${W}; border-color: ${INK}; }
  @media (max-width: 900px) {
    .s-hero-h1 { font-size: 48px !important; }
    .s-sec-h2 { font-size: 36px !important; }
    .s-grid { grid-template-columns: 1fr !important; }
    .s-pad { padding: 72px 24px !important; }
    .s-hero { padding: 140px 24px 72px !important; }
  }
`

const TAG_COLORS = { LNG: '#6366f1', SEM: '#8b5cf6', ENT: GRN, TOP: R, SNT: AMB, SQA: '#ef4444', DPA: '#0ea5e9', CSG: T }

const CATEGORIES = [
  { id: 'linguistic', name: 'Linguistic & Syntactic Analysis', tag: 'LNG', count: 8, subtitle: 'Agents that operate at sentence, word, and grammatical structure level', agents: [
    { name: 'Algorithmic Authorship Analyzer', desc: 'Scans documents and identifies sentences that match problematic patterns \u2014 conditionals, filler words, unclear nested statements, claims without reasons.', detects: ['Sentences starting with conditional clauses', 'Unnecessary filler words', 'Statements that should be questions', 'Unclear nested statements', 'Plural nouns without examples', 'Claims without supporting reasons'], useCases: ['Content editing', 'Proofreading', 'Quality checks', 'Technical review'] },
    { name: 'NLP Tokenizer & Lemmatizer', desc: 'Parses text into a detailed NLP analysis table with tokens, lemmas, stems, POS tags, spelling suggestions, and dependency relations.', detects: ['Ordered tokens with positions', 'Lemmatized and stemmed forms', 'Part-of-speech tags', 'Spelling suggestions', 'Dependency relations'], useCases: ['SEO content analysis', 'NLP debugging', 'Keyword research', 'Annotation prep'] },
    { name: 'Syntax Tree Builder', desc: 'Reveals grammatical structure by parsing text into sentences, clauses, and phrases \u2014 creating syntax trees and dependency trees for content optimization.', detects: ['Hierarchical phrase structure', 'Subject-verb-object identification', 'Dependency visualizations', 'Grammatical relations'], useCases: ['SEO refinement', 'Translation QA', 'NLP preprocessing', 'Technical writing'] },
    { name: 'Contextless Word Remover', desc: 'Scans paragraphs and removes words that don\'t contribute to core meaning \u2014 stop words, vague fillers, redundant phrases, and wordy constructs.', detects: ['Stop words', 'Vague fillers', 'Redundant phrases', 'Wordy constructs', 'Unnecessary hedging'], useCases: ['SEO editing', 'Conversion copy', 'Brief refinement', 'Metadata improvement'] },
    { name: 'Vocabulary Richness Auditor', desc: 'Measures language complexity, variety, and readability by calculating sentence metrics, type/token ratios, syllable patterns, and readability scores.', detects: ['Type/token ratio', 'Syllable patterns', 'Readability levels', 'Vocabulary diversity', 'Complex word percentage'], useCases: ['Content optimization', 'Quality auditing', 'Brand voice', 'Writer training'] },
    { name: 'Metadiscourse Markers Auditor', desc: 'Identifies metadiscourse markers that organize, connect, and explain discourse \u2014 frame markers, enumerative markers, result markers.', detects: ['Frame markers', 'Enumerative markers', 'Result markers', 'Elaborative markers', 'Interactive markers'], useCases: ['Content clarity', 'Conversion tuning', 'Voice consistency', 'Brief review'] },
    { name: 'Question Logic Analyzer', desc: 'Analyzes questions and maps logical relationships between entities, breaking down connections step by step and discovering supporting entities.', detects: ['Entity relationship mapping', 'Connection breakdowns', 'Supporting entity discovery', 'Relevance scoring'], useCases: ['Entity analysis', 'SEO strategy', 'Brief creation', 'Knowledge graphs'] },
    { name: 'Context-Based Translator', desc: 'Translates documents while preserving SEO context and topical relevance, adapting phrases naturally while keeping keywords recognizable.', detects: ['SEO-preserving translation', 'Natural phrase adaptation', 'Topical authority preservation', 'Consistent terminology'], useCases: ['SEO translation', 'Localization', 'Metadata optimization', 'Authority building'] },
  ]},
  { id: 'semantic', name: 'Semantic Analysis & Meaning Extraction', tag: 'SEM', count: 9, subtitle: 'Agents focused on meaning, roles, frames, and semantic relationships', agents: [
    { name: 'Frame Semantics Analyzer', desc: 'Examines sentences and maps meaning using frame semantics \u2014 predicates, frame elements, and surface syntax to semantic role connections.', detects: ['Semantic frames', 'Frame elements (Agent, Patient, Goal)', 'Lexical units', 'Cross-domain comparison'], useCases: ['Content analysis', 'SERP analysis', 'Schema strategy', 'Brand messaging'] },
    { name: 'Semantic Role Labeler', desc: 'Marks who did what to whom, when, where, and how \u2014 AGENT, PATIENT, EXPERIENCER, INSTRUMENT, LOCATION in every clause.', detects: ['AGENT identification', 'PATIENT/THEME marking', 'INSTRUMENT labeling', 'TIME/MANNER tagging'], useCases: ['On-page optimization', 'Brief refinement', 'Competitive teardown', 'Entity prep'] },
    { name: 'Word Meaning Extractor', desc: 'Identifies all possible meanings of each word, then highlights which meaning is actually used in context with entailment scoring.', detects: ['Dictionary senses per word', 'Contextual entailment scores', 'Best-fit sense identification', 'Polysemous word handling'], useCases: ['Word-sense disambiguation', 'Keyword clarity', 'NLP analysis', 'Copy precision'] },
    { name: 'Semantic Emphasizer', desc: 'Highlights the most semantically important concepts in text, creating summary tables with relevance and importance scores.', detects: ['Key entities and concepts', 'Important attributes', 'Predicates and relationships', 'Relevance scoring'], useCases: ['Topical authority mapping', 'Schema support', 'Content audits', 'Optimization planning'] },
    { name: 'Lexical Path Analyzer', desc: 'Maps how concepts are lexically related \u2014 synonyms, antonyms, hypernyms, hyponyms \u2014 and traces multi-step paths between terms.', detects: ['Synonyms and antonyms', 'Hypernyms and hyponyms', 'Multi-step lexical paths', 'Lexical neighborhoods'], useCases: ['Topical mapping', 'Content clustering', 'Internal linking', 'Entity enrichment'] },
    { name: 'Triple Generator', desc: 'Converts paragraph meaning into structured subject-predicate-object triples with prominence scores \u2014 building blocks of knowledge graphs.', detects: ['S-P-O extraction', 'Prominence scoring', 'Entity-action-fact mapping'], useCases: ['Knowledge graphs', 'Authority mapping', 'Schema planning', 'Competitive analysis'] },
    { name: 'Relevant Item Finder', desc: 'Pinpoints the single most topically relevant content unit for a given phrase, concept, or keyword \u2014 precision targeting.', detects: ['Best-matching paragraph', 'Most aligned list item', 'Contextual phrase insertion'], useCases: ['Keyword targeting', 'Internal linking', 'Topical alignment', 'Content expansion'] },
    { name: 'Knowledge Domain Extractor', desc: 'Generates structured glossaries with 100+ semantically relevant terms, definitions, importance scores, and relationships for any topic.', detects: ['100+ relevant terms', 'Definitions in context', 'Importance scoring', 'Named entities per term'], useCases: ['Topical map design', 'Entity-first SEO', 'Niche onboarding', 'Semantic clustering'] },
    { name: 'Entity Attribute Extractor', desc: 'Analyzes any entity type and extracts structured attributes: root (universal), rare (some entities), and unique (specific entities).', detects: ['Root attributes', 'Rare attributes', 'Unique attributes', 'Prominence scoring'], useCases: ['Schema design', 'Faceted navigation', 'Programmatic SEO', 'Taxonomy building'] },
  ]},
  { id: 'entity', name: 'Entity & Knowledge Graph Intelligence', tag: 'ENT', count: 8, subtitle: 'Agents focused on entities, attributes, and structured knowledge', agents: [
    { name: 'Named Entity Inserter', desc: 'Enriches paragraphs by inserting missing but topically related entities \u2014 comparing topicality scores before and after.', detects: ['Missing implied entities', 'Topical depth strengthening', 'Before/after scoring'], useCases: ['Content enrichment', 'Authority building', 'On-page optimization'] },
    { name: 'Named Entity Suggester', desc: 'Uncovers missing but contextually relevant entities, ranking them by prominence with related predicates and adjectives.', detects: ['Missing entities', 'Prominence ranking', 'Entity attributes', 'Related predicates'], useCases: ['Content expansion', 'Entity gap analysis', 'Internal linking strategy'] },
    { name: 'Person Entity Discoverer', desc: 'Builds shared contextual domains between two subjects by discovering key named entities with a focus on people.', detects: ['Key connecting entities', 'Expert/researcher discovery', 'Shared domains', 'Bridge entities'], useCases: ['Topical mapping', 'Digital PR', 'Expert sourcing', 'Content strategy'] },
    { name: 'Comparison Agent', desc: 'Decides "which one and why" when comparing tools, strategies, or concepts \u2014 with tailored comparisons based on purpose.', detects: ['Structured comparisons', 'Decision frameworks', 'Pros/cons reasoning'], useCases: ['Product comparison', 'Technology choice', 'Strategy selection'] },
    { name: 'Person Profile Builder', desc: 'Generates structured, context-rich profiles linking people to their professional landscape, achievements, and related figures.', detects: ['Biographical profiles', 'Professional connections', 'Achievement documentation'], useCases: ['Thought-leadership mapping', 'Expert profiling', 'Career analysis'] },
    { name: 'Concept Explainer', desc: 'Creates consistent 8-sentence explanations with definitions, statistics, expert quotes, and related entity connections.', detects: ['Structured explanations', 'Statistics and data', 'Expert quotes', 'Entity connections'], useCases: ['Glossaries', 'Documentation', 'Educational content'] },
    { name: 'Information Graph Builder', desc: 'Builds arrow-based entity-relationship maps capturing central entities, connections, and missing variables.', detects: ['Entity-relationship mapping', 'Missing variable detection', 'Central entity capture'], useCases: ['Information architecture', 'Gap analysis', 'Knowledge graph design'] },
    { name: 'Irrelevant Attribute Auditor', desc: 'Flags which entity attributes are actually relevant vs sensitive or unnecessary \u2014 essential for clean data and unbiased models.', detects: ['Irrelevant attributes', 'Sensitive data flags', 'Relevance scoring'], useCases: ['Data cleaning', 'Bias auditing', 'ML feature review'] },
  ]},
  { id: 'topicality', name: 'Topicality, Authority & Coverage', tag: 'TOP', count: 7, subtitle: 'Agents that evaluate topic alignment, completeness, and authority signals', agents: [
    { name: 'Topicality Scorer', desc: 'Evaluates paragraph relevance to different topics by scoring connections with contextual phrases and related entities.', detects: ['Multi-topic relevance scoring', 'Contextual phrase analysis', 'Entity identification per topic'], useCases: ['Content auditing', 'Brief validation', 'Competitor analysis'] },
    { name: 'Bridge Topic Suggester', desc: 'Analyzes site structure to uncover topical gaps and proposes new topics with SEO-friendly URLs to bridge them.', detects: ['Topical gap detection', 'New topic proposals', 'URL suggestions'], useCases: ['Gap analysis', 'Content expansion', 'Site architecture'] },
    { name: 'Topic Clusterer', desc: 'Builds topical clusters from keyword lists with visualizations based on semantic similarity and search behavior.', detects: ['Semantic clustering', 'Search behavior patterns', 'Cluster visualizations'], useCases: ['Keyword organization', 'Authority planning', 'Content silos'] },
    { name: 'Query Term Weight Calculator', desc: 'Computes how important each term in a search query is under lexical and BERT-based processing methods.', detects: ['Term importance scoring', 'Lexical vs BERT comparison', 'Ranking signal analysis'], useCases: ['Query intent analysis', 'Keyword prioritization', 'Query expansion'] },
    { name: 'Title-Query Coverage Auditor', desc: 'Measures how well page titles cover their target queries with coverage ratio calculations.', detects: ['Coverage ratio calculations', 'Gap identification', 'Optimization priorities'], useCases: ['Content audits', 'On-page optimization', 'Migration QA'] },
    { name: 'Context Vector Aligner', desc: 'Rewrites page context paragraphs to maximize semantic relevance to target search queries.', detects: ['Semantic relevance analysis', 'Query alignment', 'Vector sharpening'], useCases: ['SEO intro optimization', 'Landing page relevance', 'Entity enrichment'] },
    { name: 'Context Paragraph Refresher', desc: 'Revises text to expert-level quality by adding definitions, statistics, expert quotes, and named entities.', detects: ['Definition enrichment', 'Statistical addition', 'Expert citations', 'Entity insertion'], useCases: ['Content refinement', 'E-E-A-T enhancement', 'Landing page optimization'] },
  ]},
  { id: 'sentiment', name: 'Sentiment & Comment Processing', tag: 'SNT', count: 2, subtitle: 'Agents focused on opinions, tone, and sentiment optimization', agents: [
    { name: 'Comment Sentiment Analyzer', desc: 'Analyzes customer comments and generates structured sentiment summaries with pros, cons, and recurring themes.', detects: ['Sentiment summaries', 'Pros/cons extraction', 'Recurring themes'], useCases: ['Review mining', 'Product comparison', 'E-commerce optimization'] },
    { name: 'Sentiment Optimizer', desc: 'Softens emotional extremes and amplifies constructive positivity in reviews with before/after comparison tables.', detects: ['Emotional balancing', 'Constructive amplification', 'Before/after comparisons'], useCases: ['Reputation management', 'Comment polishing', 'Social moderation'] },
  ]},
  { id: 'search-quality', name: 'Search Quality & Algorithm Auditing', tag: 'SQA', count: 5, subtitle: 'Agents that analyze content against search engine quality guidelines', agents: [
    { name: 'Helpful Content Auditor', desc: 'Evaluates content against helpfulness, quality, originality, and trust criteria with scored tables \u2014 built for HCU standards.', detects: ['Helpfulness scoring', 'Originality assessment', 'Trust signal analysis', 'AI content detection'], useCases: ['Quality checks', 'SEO audits', 'HCU recovery'] },
    { name: 'Quality Update Impact Analyzer', desc: 'Maps traffic changes to specific Google algorithm updates with visualizations and recovery diagnostics.', detects: ['Update-traffic correlation', 'Impact visualization', 'Recovery opportunities'], useCases: ['Traffic forensics', 'Update analysis', 'Client communication'] },
    { name: 'Spam Hit Detector', desc: 'Detects whether a site was hit by Google spam or link spam updates \u2014 forensic-level traffic pattern analysis.', detects: ['Spam update signatures', 'Traffic anomalies', 'Recovery tracking'], useCases: ['Ranking loss analysis', 'Penalty diagnosis', 'Recovery tracking'] },
    { name: 'Publication Frequency Auditor', desc: 'Analyzes publishing patterns from sitemaps with charts, URL structure analysis, and editorial calendar insights.', detects: ['Publishing patterns', 'URL categorization', 'Editorial insights'], useCases: ['Content auditing', 'Editorial planning', 'Competitor research'] },
    { name: 'Image Relevance Auditor', desc: 'Evaluates images for concept alignment \u2014 visibility, entity identification, and topicality scoring.', detects: ['Image-concept alignment', 'Entity identification', 'Topicality scoring'], useCases: ['SEO images', 'Ad creatives', 'E-commerce optimization'] },
  ]},
  { id: 'data', name: 'Data, Performance & Competitive Analysis', tag: 'DPA', count: 4, subtitle: 'Agents that analyze datasets, metrics, and competitive signals', agents: [
    { name: 'Keyword Pattern Analyzer', desc: 'Scans keyword datasets and identifies patterns \u2014 query lengths, brand mentions, correlations, and FAQ opportunities.', detects: ['Query structure patterns', 'Brand detection', 'Correlation discovery', 'FAQ extraction'], useCases: ['Keyword research', 'Gap analysis', 'Intent mapping'] },
    { name: 'Crawl Log Analyzer', desc: 'Processes crawl logs and reveals Googlebot discovery patterns \u2014 referrer visualizations, frequency tables, crawl path analysis.', detects: ['Googlebot patterns', 'Referrer analysis', 'Crawl frequency', 'Link effectiveness'], useCases: ['Crawl optimization', 'Linking evaluation', 'Bot tracking'] },
    { name: 'Outranking Cost Calculator', desc: 'Visualizes how difficult and costly it will be to outrank competitors using multiple SEO metrics.', detects: ['Difficulty analysis', 'Multi-metric calculations', 'Opportunity mapping'], useCases: ['SEO budgeting', 'Competitor analysis', 'ROI forecasting'] },
    { name: 'Backlink Profile Comparator', desc: 'Compares two websites\' backlink profiles with DR visualizations, traffic correlations, and comparison summaries.', detects: ['Profile comparisons', 'DR distributions', 'Traffic correlations'], useCases: ['Backlink analysis', 'Link prioritization', 'Gap identification'] },
  ]},
  { id: 'content', name: 'Content Structure & Safe Generation', tag: 'CSG', count: 5, subtitle: 'Agents that organize, summarize, validate, and generate content', agents: [
    { name: 'Key Fact Summarizer', desc: 'Extracts critical information from texts, ranking factual statements by prominence with named entities and attribute mapping.', detects: ['Critical information extraction', 'Prominence ranking', 'Entity mapping'], useCases: ['Content analysis', 'Briefing', 'Competitive research'] },
    { name: 'Multi-Perspective Answer Generator', desc: 'Analyzes questions from multiple expert angles \u2014 customer, researcher, manufacturer \u2014 with safe, structured explanations.', detects: ['Multi-perspective analysis', 'Structured explanations', 'Stakeholder appropriateness'], useCases: ['Strategy support', 'Stakeholder communication', 'Educational content'] },
    { name: 'Footer Architecture Planner', desc: 'Proposes SEO-friendly footer structures with contextual anchor texts and topical authority signals.', detects: ['Footer structure proposals', 'Anchor text generation', 'Authority signals'], useCases: ['Footer architecture', 'Internal linking', 'Redesign/migrations'] },
    { name: 'Semantic HTML Generator', desc: 'Converts formulas and structured data into semantic HTML with proper operators and accessibility compliance.', detects: ['Semantic HTML conversion', 'Accessibility compliance', 'SEO optimization'], useCases: ['Equation publishing', 'Accessibility', 'Technical docs'] },
    { name: 'Product Specification Generator', desc: 'Generates 40+ structured product specs ordered by decision-making importance with definitions and measurement methods.', detects: ['40+ specifications', 'Importance ordering', 'Measurement methods'], useCases: ['Product research', 'Buyer guides', 'E-commerce optimization'] },
  ]},
]

const TOTAL = CATEGORIES.reduce((s, c) => s + c.agents.length, 0)

export default function SEOAgentsPage() {
  usePageMeta({
    title: `${TOTAL} Semantic SEO Intelligence Agents \u2014 KotoIQ`,
    description: `KotoIQ's ${TOTAL} AI agents across ${CATEGORIES.length} domains: linguistic analysis, semantic extraction, entity intelligence, topical authority, and more.`,
  })

  const navigate = useNavigate()
  const [activeFilter, setActiveFilter] = useState('all')
  const [expanded, setExpanded] = useState({})

  const toggle = (name) => setExpanded(e => ({ ...e, [name]: !e[name] }))
  const filtered = activeFilter === 'all' ? CATEGORIES : CATEGORIES.filter(c => c.id === activeFilter)

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <PublicNav />

      {/* Hero */}
      <section className="s-hero" style={{ background: W, padding: '180px 40px 100px', textAlign: 'center', position: 'relative' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div className="fade" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: T, fontFamily: FH, marginBottom: 18 }}>
            KotoIQ Semantic SEO Platform
          </div>
          <h1 className="s-hero-h1 fade fade-1" style={{
            fontSize: 84, fontWeight: 900, fontFamily: FH,
            letterSpacing: '-.035em', lineHeight: 1.05,
            color: INK, maxWidth: 900, margin: '0 auto',
          }}>
            {TOTAL} AI agents.<br />
            One <span style={{ color: R }}>intelligence</span> layer.
          </h1>
          <p className="fade fade-2" style={{
            fontSize: 20, color: MUTED, fontFamily: FB,
            lineHeight: 1.55, maxWidth: 640, margin: '24px auto 0',
          }}>
            Purpose-built agents for semantic SEO \u2014 from sentence-level linguistics to knowledge graph construction to algorithm impact forensics. Composed into goal-driven workflows by the KotoIQ Strategist.
          </p>
          <div className="fade fade-3" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 36 }}>
            <button className="btn btn-primary" onClick={() => navigate('/contact')}>
              Book a demo <ArrowRight size={16} />
            </button>
            <button className="btn btn-secondary" onClick={() => document.getElementById('agents')?.scrollIntoView({ behavior: 'smooth' })}>
              Explore all {TOTAL} agents
            </button>
          </div>

          {/* Stats row */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 48,
            maxWidth: 680, margin: '64px auto 0', textAlign: 'center',
          }}>
            {[
              { n: TOTAL, l: 'AI Agents' },
              { n: CATEGORIES.length, l: 'Domains' },
              { n: 22, l: 'Orchestrated Tools' },
              { n: 3, l: 'Goal Types' },
            ].map((s, i) => (
              <div key={i} className="fade" style={{ animationDelay: `${0.3 + i * 0.08}s` }}>
                <div style={{ fontSize: 36, fontWeight: 900, fontFamily: FH, color: INK, letterSpacing: '-.02em' }}>{s.n}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: FAINT, marginTop: 4, fontFamily: FB }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Filter pills */}
      <section id="agents" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px 24px' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className={`pill ${activeFilter === 'all' ? 'active' : ''}`} onClick={() => setActiveFilter('all')}>All ({TOTAL})</button>
          {CATEGORIES.map(c => (
            <button key={c.id} className={`pill ${activeFilter === c.id ? 'active' : ''}`} onClick={() => setActiveFilter(c.id)}>
              {c.name.split(' ')[0]} ({c.count})
            </button>
          ))}
        </div>
      </section>

      {/* Agent grid */}
      <section className="s-pad" style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 40px 100px' }}>
        {filtered.map(cat => {
          const tagColor = TAG_COLORS[cat.tag] || T
          return (
            <div key={cat.id} id={cat.id} style={{ marginBottom: 56 }}>
              <div style={{ borderBottom: `2px solid ${INK}`, paddingBottom: 10, marginBottom: 20 }}>
                <h2 className="s-sec-h2" style={{ fontSize: 44, fontWeight: 900, fontFamily: FH, color: INK, letterSpacing: '-.03em', margin: 0 }}>{cat.name}</h2>
                <p style={{ fontSize: 15, color: MUTED, marginTop: 6, fontFamily: FB }}>{cat.count} agents \u2014 {cat.subtitle}</p>
              </div>
              <div className="s-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
                {cat.agents.map(agent => {
                  const isOpen = expanded[agent.name]
                  return (
                    <div key={agent.name} className="agent-card" style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 800, color: tagColor, background: tagColor + '14',
                          padding: '2px 7px', borderRadius: 4, letterSpacing: '.06em', fontFamily: FH,
                        }}>{cat.tag}</span>
                        <h3 style={{ fontSize: 16, fontWeight: 800, color: INK, margin: 0, fontFamily: FH }}>{agent.name}</h3>
                      </div>
                      <p style={{ fontSize: 14, color: '#4b5563', lineHeight: 1.55, fontFamily: FB, flex: 1, margin: '0 0 12px' }}>{agent.desc}</p>

                      <button
                        onClick={() => toggle(agent.name)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          fontSize: 12, fontWeight: 700, color: tagColor, background: 'none', border: 'none',
                          cursor: 'pointer', fontFamily: FH, padding: 0,
                        }}
                      >
                        {isOpen ? 'Hide details' : 'View details'}
                        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>

                      {isOpen && (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${HAIR}` }}>
                          <div style={{ fontSize: 10, fontWeight: 800, color: INK, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: FH, marginBottom: 4 }}>Capabilities</div>
                          <ul style={{ margin: '0 0 12px', padding: '0 0 0 16px', fontSize: 13, color: '#4b5563', lineHeight: 1.6, fontFamily: FB }}>
                            {agent.detects.map((d, i) => <li key={i}>{d}</li>)}
                          </ul>
                          <div style={{ fontSize: 10, fontWeight: 800, color: INK, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: FH, marginBottom: 4 }}>Use Cases</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {agent.useCases.map((u, i) => (
                              <span key={i} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 100, background: SURFACE, color: '#374151', fontFamily: FB, fontWeight: 600 }}>{u}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </section>

      {/* CTA */}
      <section style={{ background: INK, padding: '80px 40px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 44, fontWeight: 900, fontFamily: FH, color: W, letterSpacing: '-.03em', margin: 0 }}>
          Ready to put {TOTAL} agents to work?
        </h2>
        <p style={{ fontSize: 18, color: FAINT, fontFamily: FB, lineHeight: 1.55, maxWidth: 540, margin: '16px auto 0' }}>
          Tell us what you need. We build the agent workflow, connect your data, and deliver results \u2014 not another dashboard you have to figure out.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 32 }}>
          <button className="btn" style={{ background: R, color: W, padding: '15px 28px', fontSize: 15 }} onClick={() => navigate('/contact')}>
            Book a 20-min build session <ArrowRight size={16} />
          </button>
        </div>
      </section>

      <PublicFooter />
    </>
  )
}
