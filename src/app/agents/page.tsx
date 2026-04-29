import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'KotoIQ AI Agents — 48 Semantic SEO Intelligence Agents',
  description: 'Explore KotoIQ\'s 48 AI agents across 8 domains: linguistic analysis, semantic extraction, entity intelligence, topical authority, sentiment processing, search quality auditing, performance analysis, and content optimization.',
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent data — 48 agents across 8 categories
// ─────────────────────────────────────────────────────────────────────────────

interface Agent {
  name: string
  tag: string
  description: string
  detects: string[]
  useCases: string[]
  input: string[]
}

interface Category {
  name: string
  count: number
  subtitle: string
  agents: Agent[]
}

const R = '#E6007E'
const T = '#00C2CB'
const BLK = '#111111'
const FH = "'Syne','Proxima Nova','Helvetica Neue',sans-serif"
const FB = "'DM Sans','Raleway','Helvetica Neue',sans-serif"

const CATEGORIES: Category[] = [
  {
    name: 'Linguistic & Syntactic Analysis',
    count: 8,
    subtitle: 'Agents that operate at sentence, word, and grammatical structure level',
    agents: [
      {
        name: 'Algorithmic Authorship Analyzer',
        tag: 'LNG',
        description: 'Scans documents and identifies sentences that match problematic patterns — sentences starting with conditionals, unnecessary filler words, unclear nested statements, and more.',
        detects: ['Sentences starting with conditional clauses', 'Unnecessary filler words (also, additionally, in addition to)', 'Statements that should be questions but aren\'t', 'Unclear nested statements reducing readability', 'Plural nouns without supporting examples', 'Claims stated without supporting reasons'],
        useCases: ['Content editing', 'Proofreading', 'Document quality checks', 'Academic writing', 'Policy & technical review'],
        input: ['Blog posts', 'Landing page copy', 'Product descriptions', 'Category pages', 'Metadata (titles, meta descriptions)', 'Content briefs'],
      },
      {
        name: 'NLP Tokenizer & Lemmatizer',
        tag: 'LNG',
        description: 'Parses text into a detailed NLP analysis table with tokens, lemmas, stems, POS tags, spelling suggestions, and dependency relations.',
        detects: ['Breaking text into ordered tokens with positions', 'Generating lemmatized and stemmed word forms', 'Assigning part-of-speech tags (NOUN, VERB, ADJ)', 'Spelling suggestions for incorrect tokens', 'Word sense and meaning in context', 'Dependency relations (parent token and relation type)'],
        useCases: ['SEO content analysis', 'NLP debugging', 'Keyword research', 'Annotation prep', 'Educational use'],
        input: ['Single sentences or headlines', 'Short paragraphs (5-300 words)', 'English prose without HTML or code'],
      },
      {
        name: 'Syntax Tree Builder',
        tag: 'LNG',
        description: 'Reveals grammatical structure by parsing text into sentences, clauses, and phrases — creating syntax trees and dependency trees for content optimization.',
        detects: ['Parsing paragraphs into sentences, clauses, and phrases', 'Identifying subjects, verbs, objects, and modifiers', 'Creating hierarchical phrase structure trees (NP, VP, PP)', 'Visualizing dependency relationships between words', 'Core grammatical relations (nsubj, dobj, aux, advmod)'],
        useCases: ['SEO content refinement', 'Translation QA', 'NLP preprocessing', 'Technical writing', 'Syntax learning'],
        input: ['Single sentences', 'Short paragraphs', 'Blog posts', 'Landing page copy', 'Metadata'],
      },
      {
        name: 'Contextless Word Remover',
        tag: 'LNG',
        description: 'Scans paragraphs and removes words that don\'t contribute to core meaning — stop words, vague fillers, redundant phrases, and wordy constructs.',
        detects: ['Stop words that add length but not value', 'Vague fillers (some, one of the, a number of)', 'Redundant phrases (is able to, in order to)', 'Wordy constructs that can be shortened', 'Repeated ideas that don\'t add information', 'Unnecessary hedging that weakens clarity'],
        useCases: ['SEO editing', 'Conversion copy optimization', 'Content brief refinement', 'Metadata improvement'],
        input: ['Paragraphs with 2-3+ sentences', 'Plain text (30-800 words)', 'English prose without HTML'],
      },
      {
        name: 'Vocabulary Richness Auditor',
        tag: 'LNG',
        description: 'Measures how complex, varied, and readable language is by calculating sentence metrics, type/token ratios, syllable patterns, and readability scores.',
        detects: ['Sentence count and average sentence length', 'Total tokens and unique word types', 'Type/token ratio for vocabulary diversity', 'Syllable patterns and readability levels', 'Complex word percentage (3+ syllables)', 'Overall vocabulary richness score'],
        useCases: ['SEO content optimization', 'Content quality auditing', 'Brand voice consistency', 'Writer training'],
        input: ['Paragraphs with 2-3+ sentences', 'Plain text (30-800 words)', 'English prose'],
      },
      {
        name: 'Metadiscourse Markers Auditor',
        tag: 'LNG',
        description: 'Identifies metadiscourse markers that organize, connect, and explain discourse — frame markers, enumerative markers, result markers, and more.',
        detects: ['Frame markers that introduce or situate topics', 'Enumerative markers that list or sequence components', 'Result markers signaling consequences or outcomes', 'Elaborative markers that clarify or restate ideas', 'Interactive markers highlighting communal involvement'],
        useCases: ['SEO content optimization', 'Content clarity & flow', 'Conversion copy tuning', 'Brand voice consistency'],
        input: ['Blog posts', 'Landing page copy', 'Product descriptions', 'Category pages', 'Content briefs (1-5 paragraphs)'],
      },
      {
        name: 'Question Logic Analyzer',
        tag: 'LNG',
        description: 'Analyzes questions and maps logical relationships between entities, breaking down connections step by step and discovering supporting entities.',
        detects: ['Entity-to-entity relationship mapping', 'Step-by-step connection breakdowns', 'Supporting entity discovery', 'Relationship tables with relevance scoring', 'Non-connection detection with explanations'],
        useCases: ['Entity relationship analysis', 'SEO strategy', 'Content brief creation', 'Knowledge graph thinking'],
        input: ['Clear questions with at least two entities', 'Optional context, goal, or constraints'],
      },
      {
        name: 'Context-Based Translator',
        tag: 'LNG',
        description: 'Translates documents while preserving SEO context and topical relevance, adapting phrases naturally while keeping keywords recognizable.',
        detects: ['SEO term translation without losing search intent', 'Natural phrase adaptation while preserving keywords', 'Topical authority preservation across languages', 'Context-based equivalents, not literal translation', 'Consistent terminology across entire documents'],
        useCases: ['SEO translation', 'Content localization', 'Metadata optimization', 'Topical authority building'],
        input: ['Blog posts', 'Landing pages', 'Product descriptions', 'Metadata', 'Primary keywords and target audience'],
      },
    ],
  },
  {
    name: 'Semantic Analysis & Meaning Extraction',
    count: 9,
    subtitle: 'Agents focused on meaning, roles, frames, and semantic relationships',
    agents: [
      { name: 'Frame Semantics Analyzer', tag: 'SEM', description: 'Examines sentences and maps their meaning using frame semantics — identifying predicates, frame elements, and connecting surface syntax to semantic roles.', detects: ['Main predicates and semantic frames they evoke', 'Frame elements (Agent, Patient, Experiencer, Instrument, Goal)', 'Core vs non-core frame element analysis', 'Surface syntax to semantic role connections', 'Predicate behavior comparison across domains'], useCases: ['SEO content analysis', 'Content optimization', 'SERP analysis', 'Entity and schema strategy'], input: ['Blog posts', 'Landing page sections', 'Product descriptions', 'Metadata', 'Target keywords'] },
      { name: 'Semantic Role Labeler', tag: 'SEM', description: 'Analyzes sentences and marks who did what to whom, when, where, and how — identifying AGENT, PATIENT, EXPERIENCER, INSTRUMENT, LOCATION, and more.', detects: ['AGENT (doer of the action)', 'PATIENT/THEME (entity affected)', 'EXPERIENCER (entity that perceives)', 'INSTRUMENT, LOCATION, SOURCE, GOAL, TIME, MANNER', 'Main predicate and semantic argument distinction'], useCases: ['SEO content analysis', 'On-page optimization', 'Content brief refinement', 'Entity/knowledge graph prep'], input: ['Single sentences', 'Short paragraphs', 'Above-the-fold copy', 'Meta title + description pairs'] },
      { name: 'Word Meaning Extractor', tag: 'SEM', description: 'Identifies all possible meanings of each word, then highlights which meaning is actually used in context with entailment scoring.', detects: ['Every dictionary sense of each word', 'Contextual entailment scores per meaning', 'Best-fit sense identification', 'Polysemous word handling with relevance ranking'], useCases: ['Word-sense disambiguation', 'SEO keyword clarity', 'Semantic/NLP analysis', 'Copy review for precision'], input: ['Single paragraphs', 'Article snippets', 'H1 + first paragraph', 'Sentence lists for ambiguous words'] },
      { name: 'Semantic Emphasizer', tag: 'SEM', description: 'Highlights the most semantically important concepts in text, creating summary tables with relevance and importance scores.', detects: ['Primary topic identification and analysis focus', 'Key entities (people, places, things, concepts)', 'Important attributes (qualities, features, metrics)', 'Predicates and relationships (actions, cause-effect)', 'Relevance and importance scoring per term'], useCases: ['SEO content analysis', 'Topical authority mapping', 'Schema & structured data support', 'Content audits'], input: ['Blog posts', 'Landing pages', 'Product descriptions', 'FAQ sections', 'Service pages'] },
      { name: 'Lexical Path Analyzer', tag: 'SEM', description: 'Maps how concepts are lexically related — synonyms, antonyms, hypernyms, hyponyms — and traces multi-step lexical paths between terms.', detects: ['Synonyms, antonyms, hypernyms, hyponyms', 'Multi-step lexical paths between concepts', 'Intermediate term connections', 'Ambiguous term disambiguation via lexical neighborhoods'], useCases: ['Topical mapping', 'Content clustering', 'Internal linking strategy', 'Entity enrichment'], input: ['Blog posts', 'Landing pages', 'Keyword lists', 'Entity lists', 'FAQ sections'] },
      { name: 'Triple Generator', tag: 'SEM', description: 'Converts paragraph meaning into structured subject-predicate-object triples with prominence scores — the building blocks of knowledge graphs.', detects: ['Subject-predicate-object relationship extraction', 'Organized triple tables with prominence scoring', 'Prominence score explanations per triple', 'Main entities, actions, and facts identification'], useCases: ['Knowledge graph building', 'Topical authority mapping', 'Schema planning', 'Competitive analysis'], input: ['Blog posts', 'Landing pages', 'Product descriptions', 'Metadata', 'Content briefs'] },
      { name: 'Relevant Item Finder', tag: 'SEM', description: 'Pinpoints the single most topically relevant content unit for a given phrase, concept, or keyword — the precision targeting agent.', detects: ['Best-matching paragraph for a target keyword', 'Most aligned list item for a user intent', 'Semantically closest table entry to a concept', 'Contextual phrase insertion into selected content'], useCases: ['Keyword targeting', 'Internal linking', 'Topical alignment', 'Content expansion'], input: ['Blog posts', 'Landing pages', 'One contextual phrase/keyword to match'] },
      { name: 'Knowledge Domain Extractor', tag: 'SEM', description: 'Generates structured glossaries with 100+ semantically relevant terms, definitions, importance scores, and entity relationships for any topic.', detects: ['100+ semantically relevant terms per topic', 'Concise definitions in topic context', 'Importance scoring per term', 'Named entities and essential predicates per term'], useCases: ['Topical map design', 'Entity-first SEO', 'Content briefing', 'Niche onboarding'], input: ['One clear topic name (e.g., "Technical SEO", "Local SEO for dentists")'] },
      { name: 'Entity Attribute Extractor', tag: 'SEM', description: 'Analyzes any entity type and extracts structured attributes: root (universal), rare (some entities), and unique (specific entities).', detects: ['Root attributes (present in all entities of a type)', 'Rare attributes (present in some)', 'Unique attributes (specific to individual entities)', 'Attribute prominence and relevance scoring'], useCases: ['Entity schema design', 'Faceted navigation', 'Programmatic SEO templates', 'Taxonomy building'], input: ['Entity type to analyze', 'Optional: business context, example entities'] },
    ],
  },
  {
    name: 'Entity & Knowledge Graph Intelligence',
    count: 8,
    subtitle: 'Agents focused on entities, attributes, and structured knowledge',
    agents: [
      { name: 'Named Entity Inserter', tag: 'ENT', description: 'Enriches paragraphs by inserting missing but topically related entities, explaining relevance and comparing topicality scores before and after.', detects: ['Important entities implied by heading but not mentioned', 'Entity insertion that strengthens topical depth', 'Before/after topicality score comparison', 'New entity relevance explanations'], useCases: ['Content enrichment', 'Topical authority building', 'On-page optimization', 'E-commerce SEO'], input: ['A heading (H1/H2/H3)', 'Subordinate paragraph', 'Optional: target keywords, page type'] },
      { name: 'Named Entity Suggester', tag: 'ENT', description: 'Analyzes paragraphs and uncovers missing but contextually relevant entities, ranking them by prominence with related predicates and adjectives.', detects: ['Missing people, brands, places, events, concepts', 'Prominence-ranked entity suggestions', 'Entity attributes (type, role, category)', 'Related predicates and adjectives per entity'], useCases: ['Content expansion', 'Topical authority building', 'Entity gap analysis', 'Internal linking strategy'], input: ['Blog posts', 'Landing pages', 'Product descriptions', 'Optional: main keyword'] },
      { name: 'Person Entity Discoverer', tag: 'ENT', description: 'Takes two subjects and builds shared contextual domains by discovering key named entities with a focus on people — experts, researchers, founders.', detects: ['Key named entities connecting two subjects', 'People focus (experts, influencers, researchers, founders)', 'Shared contextual domains between concepts', 'Bridge entities for content connections'], useCases: ['Topical mapping', 'Content strategy', 'Digital PR & outreach', 'Expert sourcing'], input: ['Two main subjects or topics to connect', 'Optional: focus area or industry context'] },
      { name: 'Comparison Agent', tag: 'ENT', description: 'Helps decide "which one and why" when comparing tools, strategies, or concepts — with tailored comparisons based on your specific purpose.', detects: ['Structured tool/strategy/concept comparisons', 'Purpose-tailored decision frameworks', 'Clear pros/cons with recommendation reasoning'], useCases: ['Product comparison', 'Technology choice', 'Strategy selection', 'Vendor evaluation'], input: ['Two or more items to compare', 'Your specific purpose or use case'] },
      { name: 'Person Profile Builder', tag: 'ENT', description: 'Generates structured, context-rich profiles of people, linking them to their professional landscape with achievements and related figures.', detects: ['Structured biographical profiles', 'Professional landscape connections', 'Achievement documentation', 'Related figure identification'], useCases: ['Biographical lookup', 'Thought-leadership mapping', 'Expert profiling', 'Career context analysis'], input: ['Person name', 'Optional: field of interest, time period'] },
      { name: 'Concept Explainer', tag: 'ENT', description: 'Creates consistent 8-sentence explanations for any concept with definitions, statistics, expert quotes, and related entity connections.', detects: ['Consistent 8-sentence structured explanations', 'Definitions and core concepts', 'Relevant statistics and data', 'Expert quotes and entity connections'], useCases: ['Concept glossaries', 'Documentation', 'Marketing & SEO glossaries', 'Educational content'], input: ['A "What is X?" question', 'Optional: audience level, domain context'] },
      { name: 'Information Graph Builder', tag: 'ENT', description: 'Analyzes documents and builds arrow-based entity-relationship maps capturing central entities, connections, and missing variables.', detects: ['Entity relationship mapping', 'Arrow-based visual representations', 'Missing variable identification', 'Central entity and connection capture'], useCases: ['Content modeling', 'Information architecture', 'Gap analysis', 'Knowledge graph design'], input: ['Documents, contracts, or policies', 'Structured or semi-structured text'] },
      { name: 'Irrelevant Attribute Auditor', tag: 'ENT', description: 'Scans entity-attribute lists and flags which attributes are actually relevant vs sensitive or unnecessary — essential for clean data and unbiased models.', detects: ['Irrelevant demographic attributes', 'Sensitive or unnecessary attributes', 'Business-relevant vs distracting attributes', 'Relevance scoring per entity-attribute pair'], useCases: ['Data cleaning', 'Bias auditing', 'ML feature review', 'Form & survey design'], input: ['Entity-attribute tables', 'Bullet lists of entities', 'Schema or JSON descriptions'] },
    ],
  },
  {
    name: 'Topicality, Authority & Coverage',
    count: 7,
    subtitle: 'Agents that evaluate topic alignment, completeness, and authority signals',
    agents: [
      { name: 'Topicality Scorer', tag: 'TOP', description: 'Evaluates how relevant a paragraph is to different topics by scoring each connection with contextual phrases and related entities.', detects: ['Paragraph relevance to multiple topics', 'Topic connection scoring with contextual phrases', 'Related entity identification per topic', 'Comparative topicality analysis'], useCases: ['SEO content auditing', 'Content planning', 'Competitor analysis', 'Brief validation'], input: ['Paragraph or text to analyze', 'List of topics to score against'] },
      { name: 'Bridge Topic Suggester', tag: 'TOP', description: 'Analyzes site structure to uncover topical gaps and proposes new, relevant topics with SEO-friendly URLs to bridge them.', detects: ['Topical gaps in existing content', 'New relevant topic proposals', 'SEO-friendly URL suggestions', 'Content expansion opportunities'], useCases: ['Topical gap analysis', 'Content expansion', 'Site architecture planning', 'Content roadmap'], input: ['Title tags and URL structures', 'Optional: competitor data, target niche'] },
      { name: 'Topic Clusterer', tag: 'TOP', description: 'Takes keyword lists and automatically builds topical clusters with visualizations based on semantic similarity and search behavior.', detects: ['Topical cluster building from keywords', 'Semantic similarity grouping', 'Cluster relationship visualizations', 'Search behavior pattern analysis'], useCases: ['Keyword research organization', 'Topical authority planning', 'Content silo structure', 'Intent-based strategy'], input: ['Keyword lists', 'Optional: search volume data, target topic'] },
      { name: 'Query Term Weight Calculator', tag: 'TOP', description: 'Computes how important each term in a search query is under different processing methods — both lexical and BERT-based.', detects: ['Term importance for search queries', 'Lexical vs BERT-based weight comparison', 'Which terms matter most for ranking', 'Query expansion opportunities'], useCases: ['Query intent analysis', 'Keyword prioritization', 'Query expansion', 'Content strategy'], input: ['Search queries', 'Optional: target page context'] },
      { name: 'Title-Query Coverage Auditor', tag: 'TOP', description: 'Measures how well page titles cover their target queries with coverage ratio calculations — essential for metadata optimization.', detects: ['Title-to-query coverage ratios', 'Coverage gap identification', 'Optimization opportunities', 'Metadata cleanup priorities'], useCases: ['Content audits', 'On-page optimization', 'Migration QA', 'Title optimization'], input: ['CSV with page titles and target queries', 'GSC export data'] },
      { name: 'Context Vector Aligner', tag: 'TOP', description: 'Analyzes page context paragraphs and rewrites them to maximize semantic relevance to target search queries.', detects: ['Semantic relevance analysis', 'Content rewriting for query alignment', 'Semantic vector sharpening', 'Entity enrichment and topic alignment'], useCases: ['SEO intro optimization', 'Landing page relevance', 'Blog topic focus', 'Entity enrichment'], input: ['Context paragraph or page intro', 'Target search query'] },
      { name: 'Context Paragraph Refresher', tag: 'TOP', description: 'Revises existing text to become more context-rich and expert-level — adding definitions, statistics, expert quotes, and named entities.', detects: ['Text enrichment with definitions and context', 'Statistical and data point addition', 'Expert quote incorporation', 'Named entity insertion for depth'], useCases: ['SEO content refinement', 'Landing page optimization', 'E-E-A-T enhancement'], input: ['Paragraph to refresh', 'Target topic or keyword'] },
    ],
  },
  {
    name: 'Sentiment & Comment Processing',
    count: 2,
    subtitle: 'Agents focused on opinions, tone, and sentiment optimization',
    agents: [
      { name: 'Comment Sentiment Analyzer', tag: 'SNT', description: 'Analyzes multiple customer comments and generates structured sentiment summaries with pros, cons, and recurring themes.', detects: ['Structured sentiment summaries from reviews', 'Pros and cons extraction', 'Recurring theme identification', 'Product comparison support data'], useCases: ['Review mining', 'Product comparison', 'E-commerce optimization', 'Feature prioritization'], input: ['Multiple customer comments or reviews', 'Product or service name'] },
      { name: 'Sentiment Optimizer', tag: 'SNT', description: 'Transforms reviews by softening emotional extremes and amplifying constructive positivity, with detailed before/after comparison tables.', detects: ['Emotional extreme softening', 'Constructive positivity amplification', 'Before/after comparison generation', 'Authentic voice preservation'], useCases: ['Review rewriting', 'Reputation management', 'Comment polishing', 'Social media moderation'], input: ['Review or comment to optimize', 'Optional: desired tone, brand voice guidelines'] },
    ],
  },
  {
    name: 'Search Quality & Algorithm Auditing',
    count: 5,
    subtitle: 'Agents that analyze content against search engine quality guidelines',
    agents: [
      { name: 'Helpful Content Auditor', tag: 'SQA', description: 'Evaluates content against helpfulness, quality, originality, and trust criteria with scored audit tables — built for Google\'s Helpful Content standards.', detects: ['Helpfulness criteria evaluation', 'Quality, originality, and trust scoring', 'Original reporting and coverage depth', 'AI-generated content pattern detection'], useCases: ['Content quality checks', 'SEO content audits', 'Originality review', 'HCU recovery planning'], input: ['Content to audit', 'Optional: target keyword, competitor content'] },
      { name: 'Quality Update Impact Analyzer', tag: 'SQA', description: 'Maps traffic changes to specific Google algorithm updates with visualizations and impact analysis — essential for recovery diagnostics.', detects: ['Traffic-to-update correlation mapping', 'Impact visualization generation', 'Traffic forensics patterns', 'Recovery opportunity identification'], useCases: ['Traffic forensics', 'Update impact analysis', 'Recovery diagnostics', 'Client communication'], input: ['Traffic data (GSC, GA export)', 'Date ranges covering update periods'] },
      { name: 'Spam Hit Detector', tag: 'SQA', description: 'Analyzes SEO traffic data to detect whether a website was hit by specific Google spam or link spam updates — with forensic-level detail.', detects: ['Spam and link spam update impact signatures', 'Traffic pattern anomalies', 'Specific update hit identification', 'Recovery tracking over time'], useCases: ['Traffic forensics', 'Ranking loss analysis', 'Client reporting', 'Penalty diagnosis'], input: ['SEO traffic data (CSV)', 'Date ranges covering suspected impact'] },
      { name: 'Publication Frequency Auditor', tag: 'SQA', description: 'Reads sitemaps and analyzes publishing patterns over time with charts, URL structure analysis, and editorial calendar insights.', detects: ['Publication frequency analysis', 'Publishing pattern charts', 'URL structure categorization', 'Editorial calendar insights'], useCases: ['Content auditing', 'Editorial planning', 'Site architecture analysis', 'Content velocity tracking'], input: ['Sitemap CSV with URLs and dates', 'Optional: competitor data'] },
      { name: 'Image Relevance Auditor', tag: 'SQA', description: 'Evaluates images for how well they match a given textual concept — checking visibility, entity identification, and topicality scores.', detects: ['Image-to-concept alignment scoring', 'Subject visibility and clarity', 'Entity identification within images', 'Topicality and relevance scoring'], useCases: ['SEO & content images', 'Ad creatives', 'E-commerce pages', 'Image-text alignment'], input: ['Image to audit', 'Target concept or keyword'] },
    ],
  },
  {
    name: 'Data, Performance & Competitive Analysis',
    count: 4,
    subtitle: 'Agents that analyze datasets, metrics, and competitive signals',
    agents: [
      { name: 'Keyword Pattern Analyzer', tag: 'DPA', description: 'Scans SEO keyword datasets and identifies patterns — query lengths, brand mentions, correlations, question words, and FAQ opportunities.', detects: ['Query length and structure patterns', 'Brand and company name detection', 'Query property correlations', 'Question word and FAQ extraction'], useCases: ['Keyword research', 'Competitor gap analysis', 'Intent & topic mapping', 'FAQ discovery'], input: ['Keyword datasets (CSV)', 'Optional: search volume, competitor keywords'] },
      { name: 'Crawl Log Analyzer', tag: 'DPA', description: 'Processes crawl logs and reveals how Googlebot discovers your site — referrer URL visualizations, frequency tables, and crawl path analysis.', detects: ['Googlebot discovery patterns', 'Referrer URL visualizations', 'Crawl frequency analysis', 'Internal linking effectiveness signals'], useCases: ['Crawl behavior analysis', 'Internal linking evaluation', 'Crawl optimization', 'Bot behavior tracking'], input: ['Server log files with Googlebot requests', 'Optional: URL patterns, date ranges'] },
      { name: 'Outranking Cost Calculator', tag: 'DPA', description: 'Analyzes competitor SEO data and visualizes how difficult and costly it will be to outrank them — supporting budget decisions and ROI forecasting.', detects: ['Competitor difficulty and cost analysis', 'Multi-metric outranking calculations', 'Opportunity mapping and prioritization', 'Budget forecasting data'], useCases: ['Competitor analysis', 'SEO budgeting', 'Opportunity mapping', 'ROI forecasting'], input: ['Competitor SEO data (backlinks, DR, traffic)', 'Target keywords'] },
      { name: 'Backlink Profile Comparator', tag: 'DPA', description: 'Compares two websites\' backlink profiles with domain rating visualizations, traffic correlations, and written comparison summaries.', detects: ['Backlink profile comparisons', 'DR distribution visualizations', 'Traffic-to-link correlations', 'Written comparison summaries'], useCases: ['Competitor backlink analysis', 'Link-building prioritization', 'Authority growth tracking', 'Gap identification'], input: ['Backlink data for two websites', 'Ahrefs, Moz, or similar exports'] },
    ],
  },
  {
    name: 'Content Structure & Safe Generation',
    count: 5,
    subtitle: 'Agents that organize, summarize, validate, and generate content',
    agents: [
      { name: 'Key Fact Summarizer', tag: 'CSG', description: 'Extracts structured critical information from texts, ranking factual statements by prominence with named entities and attribute mapping.', detects: ['Structured critical information extraction', 'Factual statement prominence ranking', 'Named entity and attribute identification', 'Competitive research fact extraction'], useCases: ['SEO content analysis', 'Entity & attribute mapping', 'Content briefing', 'Competitive research'], input: ['Text to analyze', 'Optional: focus topics, output format'] },
      { name: 'Multi-Perspective Answer Generator', tag: 'CSG', description: 'Analyzes questions from multiple expert angles — customer, researcher, manufacturer — providing rich, safe, structured explanations.', detects: ['Multi-perspective question analysis', 'Customer, researcher, manufacturer viewpoints', 'Structured safe explanations', 'Stakeholder-appropriate responses'], useCases: ['Multi-angle SEO analysis', 'Strategy decision support', 'Stakeholder communication', 'Educational content'], input: ['Question to analyze', 'Optional: perspectives, audience, constraints'] },
      { name: 'Footer Architecture Planner', tag: 'CSG', description: 'Analyzes page metadata and content to propose SEO-friendly footer structures with contextual anchor texts and topical authority signals.', detects: ['SEO-friendly footer structure proposals', '5-column layout generation', 'Contextual anchor text creation', 'Topical authority support signals'], useCases: ['Footer architecture', 'Internal linking', 'Topical authority', 'Redesign/migrations'], input: ['Current footer or sitemap', 'Page metadata'] },
      { name: 'Semantic HTML Generator', tag: 'CSG', description: 'Converts mathematical formulas and structured data into semantic HTML with proper operators, accessibility compliance, and SEO optimization.', detects: ['Formula to semantic HTML conversion', 'Proper element structure', 'Accessibility compliance', 'SEO-optimized output'], useCases: ['Equation publishing', 'Accessibility', 'SEO optimization', 'Technical documentation'], input: ['Mathematical formula or structured data'] },
      { name: 'Product Specification Generator', tag: 'CSG', description: 'Generates 40+ structured product specifications ordered by decision-making importance — with definitions, measurement methods, and buyer-ready formatting.', detects: ['40+ structured product specifications', 'Decision-making importance ordering', 'Definitions and measurement methods', 'Buyer guide readiness'], useCases: ['Product research', 'Buyer guides', 'E-commerce optimization', 'Comparison pages'], input: ['Product name or type', 'Optional: category, spec count, focus areas'] },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────

const TAG_COLORS: Record<string, string> = {
  LNG: '#6366f1',
  SEM: '#8b5cf6',
  ENT: '#059669',
  TOP: R,
  SNT: '#f59e0b',
  SQA: '#ef4444',
  DPA: '#0ea5e9',
  CSG: T,
}

export default function AgentsPage() {
  const totalAgents = CATEGORIES.reduce((sum, c) => sum + c.agents.length, 0)

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff', fontFamily: FB }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid #e5e7eb', padding: '16px 0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="https://hellokoto.com" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: BLK, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 15, fontFamily: FH }}>K</div>
            <span style={{ fontSize: 18, fontWeight: 800, color: BLK, fontFamily: FH, letterSpacing: '-0.02em' }}>KotoIQ</span>
          </a>
          <a href="https://hellokoto.com" style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', textDecoration: 'none', fontFamily: FB }}>Back to Platform</a>
        </div>
      </header>

      {/* Hero */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '72px 24px 56px' }}>
        <div style={{ maxWidth: 680 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: R, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16, fontFamily: FH }}>{totalAgents} AI Agents</div>
          <h1 style={{ fontSize: 44, fontWeight: 800, color: BLK, lineHeight: 1.1, letterSpacing: '-0.03em', margin: 0, fontFamily: FH }}>
            Semantic SEO Intelligence
          </h1>
          <p style={{ fontSize: 17, color: '#4b5563', lineHeight: 1.65, marginTop: 20, maxWidth: 580, fontFamily: FB }}>
            {totalAgents} purpose-built agents across {CATEGORIES.length} domains. Each one handles a specific SEO analysis task — from sentence-level linguistics to knowledge graph construction to algorithm impact forensics. The KotoIQ Strategist composes them into goal-driven workflows automatically.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 28, flexWrap: 'wrap' }}>
            {CATEGORIES.map(c => (
              <a key={c.name} href={`#${c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} style={{
                padding: '5px 12px', borderRadius: 6, background: '#f3f4f6', fontSize: 12, fontWeight: 600,
                color: '#374151', textDecoration: 'none', whiteSpace: 'nowrap', fontFamily: FB,
              }}>
                {c.name} ({c.count})
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 80px' }}>
        {CATEGORIES.map(category => (
          <div key={category.name} id={category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')} style={{ marginBottom: 56 }}>
            <div style={{ borderBottom: `2px solid ${BLK}`, paddingBottom: 10, marginBottom: 20 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: BLK, margin: 0, letterSpacing: '-0.02em', fontFamily: FH }}>{category.name}</h2>
              <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0', fontFamily: FB }}>{category.count} agents — {category.subtitle}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 14 }}>
              {category.agents.map(agent => {
                const tagColor = TAG_COLORS[agent.tag] || T
                return (
                  <div key={agent.name} style={{
                    background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '18px 20px',
                    display: 'flex', flexDirection: 'column',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 800, color: tagColor, background: tagColor + '14',
                        padding: '2px 7px', borderRadius: 4, letterSpacing: '0.06em', fontFamily: FH,
                      }}>{agent.tag}</span>
                      <h3 style={{ fontSize: 15, fontWeight: 800, color: BLK, margin: 0, lineHeight: 1.3, fontFamily: FH }}>{agent.name}</h3>
                    </div>
                    <p style={{ fontSize: 13, color: '#4b5563', margin: '0 0 12px', lineHeight: 1.55, fontFamily: FB, flex: 1 }}>{agent.description}</p>

                    <details>
                      <summary style={{ fontSize: 11, fontWeight: 700, color: tagColor, cursor: 'pointer', userSelect: 'none', fontFamily: FH }}>
                        Details
                      </summary>
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f3f4f6' }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#374151', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.06em', fontFamily: FH }}>Capabilities</div>
                        <ul style={{ margin: '0 0 10px', padding: '0 0 0 16px', fontSize: 12, color: '#4b5563', lineHeight: 1.6, fontFamily: FB }}>
                          {agent.detects.map((d, i) => <li key={i}>{d}</li>)}
                        </ul>

                        <div style={{ fontSize: 10, fontWeight: 800, color: '#374151', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.06em', fontFamily: FH }}>Use Cases</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                          {agent.useCases.map((u, i) => (
                            <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#f3f4f6', color: '#374151', fontFamily: FB }}>{u}</span>
                          ))}
                        </div>

                        <div style={{ fontSize: 10, fontWeight: 800, color: '#374151', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.06em', fontFamily: FH }}>Input</div>
                        <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 12, color: '#4b5563', lineHeight: 1.6, fontFamily: FB }}>
                          {agent.input.map((inp, i) => <li key={i}>{inp}</li>)}
                        </ul>
                      </div>
                    </details>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #e5e7eb', padding: '28px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: '#9ca3af', fontFamily: FB }}>
          <a href="https://hellokoto.com" style={{ color: R, textDecoration: 'none', fontWeight: 700 }}>Koto</a> — {totalAgents} agents. 3 orchestration goals. 22 registered tools. One platform.
        </div>
      </footer>
    </div>
  )
}
