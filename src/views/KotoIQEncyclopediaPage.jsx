"use client"

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronDown, ChevronUp, Search } from 'lucide-react'
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
  .enc-card { background: ${W}; border: 1px solid ${HAIR}; border-radius: 14px; padding: 24px 26px; transition: border-color .2s, transform .2s, box-shadow .2s; }
  .enc-card:hover { border-color: ${INK}; transform: translateY(-2px); box-shadow: 0 12px 32px rgba(17,17,17,.06); }
  .pill { cursor: pointer; padding: 8px 16px; border-radius: 100px; font-size: 13px; font-weight: 700; border: 1px solid ${HAIR}; background: ${W}; color: ${MUTED}; transition: all .15s; font-family: ${FH}; }
  .pill:hover { border-color: ${INK}; color: ${INK}; }
  .pill.active { background: ${INK}; color: ${W}; border-color: ${INK}; }
  .search-input { width: 100%; max-width: 480px; padding: 12px 16px 12px 44px; border-radius: 10px; border: 1px solid ${HAIR}; font-size: 15px; font-family: ${FB}; color: ${INK}; outline: none; transition: border-color .15s; background: ${W}; }
  .search-input:focus { border-color: ${INK}; }
  .search-input::placeholder { color: ${FAINT}; }
  @media (max-width: 900px) {
    .enc-hero-h1 { font-size: 48px !important; }
    .enc-sec-h2 { font-size: 32px !important; }
    .enc-grid { grid-template-columns: 1fr !important; }
    .enc-pad { padding: 72px 24px !important; }
    .enc-hero { padding: 140px 24px 72px !important; }
    .enc-stats { grid-template-columns: repeat(2, 1fr) !important; gap: 24px !important; }
  }
`

const TAG_COLORS = {
  CORE: R,
  TOP: '#8b5cf6',
  CTX: T,
  QRY: '#6366f1',
  ENT: GRN,
  DOC: '#0ea5e9',
  LEX: AMB,
  NLP: '#ef4444',
  SEM: '#ec4899',
  STR: '#14b8a6',
}

/* ─── Encyclopedia entries organized by category ─── */
const CATEGORIES = [
  {
    id: 'core',
    name: 'Core Framework',
    tag: 'CORE',
    subtitle: 'The foundational principles that drive KotoIQ\'s approach to search visibility',
    entries: [
      {
        name: 'Topical Authority',
        desc: 'The ability to rank over authoritative websites by achieving lower cost-of-retrieval with higher accuracy. KotoIQ calculates this as Topical Coverage multiplied by Historical Data — not time on domain, but the depth and breadth of your content ecosystem.',
        formula: 'Topical Authority = Topical Coverage x Historical Data',
        kotoiq: 'KotoIQ\'s Topical Authority tab maps your entire content ecosystem, scores coverage against competitors, and identifies the exact gaps preventing authority signals.',
      },
      {
        name: 'Historical Data',
        desc: 'Not how long your site has existed — it\'s the quality of user engagement signals over time. Mouse-overs, impressions, ranking positions, and behavioral patterns that search engines track to determine whether your content consistently satisfies queries.',
        kotoiq: 'KotoIQ tracks historical ranking movements, CTR trends, and engagement patterns through Search Console integration to surface your true historical signal strength.',
      },
      {
        name: 'Topical Coverage',
        desc: 'Complete, structured information addressing all related search activities within a topic. Partial coverage creates authority gaps — search engines can\'t trust a source that only covers 60% of what users need to know about a subject.',
        kotoiq: 'The Topical Map engine identifies every subtopic, entity, and question cluster within your target topics, then scores your existing coverage against the complete map.',
      },
      {
        name: 'Cost of Retrieval',
        desc: 'The principle that ranking a website should not cost the search engine more than the cost of NOT ranking it. If your content requires too much processing, interpretation, or validation to serve — even if it\'s good — it becomes expensive to retrieve.',
        kotoiq: 'Technical audits, content quality scores, and page speed analysis all feed into KotoIQ\'s assessment of your retrieval cost relative to competitors.',
      },
      {
        name: 'Vastness-Depth-Momentum',
        desc: 'The three-axis growth strategy: go wider (cover more topics), deeper (add more detail to existing topics), and faster (publish consistently). VDM scoring prevents the common mistake of going deep on one topic while ignoring breadth.',
        kotoiq: 'KotoIQ\'s Content Calendar uses VDM scoring to balance your editorial pipeline — ensuring you\'re building authority on all three axes simultaneously.',
      },
      {
        name: 'Quality Threshold',
        desc: 'Replaces "Keyword Difficulty" in KotoIQ\'s framework. Instead of measuring how hard it is to rank, it measures how high the content quality bar is set by current top-ranking pages. You don\'t outspend competitors — you out-quality them.',
        kotoiq: 'Every keyword in KotoIQ gets a Quality Threshold score (0-100) based on competitor content quality, query specificity, position factors, and topical coverage depth.',
      },
      {
        name: 'Ranking State',
        desc: 'Your current position and the likelihood of improvement. Ranking state isn\'t just "you\'re #7" — it\'s the gap analysis between where you are and what\'s required to move up, considering content quality, authority signals, and competitive dynamics.',
        kotoiq: 'The Ranks tab provides ranking state analysis for every tracked keyword, with movement predictions based on content changes, competitor activity, and algorithmic trends.',
      },
    ],
  },
  {
    id: 'topical',
    name: 'Topical Map & Authority',
    tag: 'TOP',
    subtitle: 'How KotoIQ structures and maps the complete content ecosystem for maximum authority',
    entries: [
      {
        name: 'Topical Map',
        desc: 'A structured network with five essential parts: source context, central entity, central search intent, core section, and outer section. Not a flat keyword list — a semantic architecture that tells search engines exactly what your site is about.',
        kotoiq: 'KotoIQ generates complete topical maps with pillar/cluster/support page hierarchies, scoring each node for coverage depth and competitive gap.',
      },
      {
        name: 'Source Context',
        desc: 'Your website\'s purpose and monetization strategy. Search engines infer source context to determine whether your content is commercially motivated, educational, or community-driven — and this affects how they weight your authority signals.',
        kotoiq: 'Client profile configuration captures source context so every piece of content KotoIQ generates aligns with your site\'s established identity.',
      },
      {
        name: 'Central Entity',
        desc: 'The primary entity that appears throughout your semantic content network. Every page in your topical map should relate back to this entity — it\'s the gravitational center of your authority.',
        kotoiq: 'The Topical Map engine identifies your central entity and ensures every content node in the map maintains a clear semantic connection to it.',
      },
      {
        name: 'Central Search Intent',
        desc: 'The unified intent that connects all pages in your topical map. While individual pages target specific queries, they all serve a common search need that reinforces your site\'s core purpose.',
        kotoiq: 'Intent classification runs across your entire keyword portfolio to identify and align content with your central search intent.',
      },
      {
        name: 'Core Section',
        desc: 'The essential pillar content that unifies source context with central search intent. These are your most authoritative, comprehensive pages — the ones that directly answer the primary questions in your topical map.',
        kotoiq: 'KotoIQ\'s Cornerstone Content Identifier agent detects which existing pages serve as core sections and where new pillars are needed.',
      },
      {
        name: 'Outer Section',
        desc: 'Content that addresses minor attributes and propagates trust signals back to the core. Outer section pages aren\'t afterthoughts — they\'re authority amplifiers that prove comprehensive coverage to search engines.',
        kotoiq: 'Bridge Topic Suggester identifies the outer section topics that would most effectively amplify your core authority.',
      },
      {
        name: 'Semantic Content Network',
        desc: 'A connected web of documents semantically optimized for related topics. Not random blog posts — a deliberately structured network where each page strengthens the others through semantic relationships and internal linking.',
        kotoiq: 'The Semantic Network tab analyzes your content as a connected graph, identifying weak connections, orphan pages, and opportunities to strengthen the network.',
      },
      {
        name: 'Topical Borders',
        desc: 'The boundary between topics that add to your authority and topics that dilute your relevance. Going too wide reduces topical focus; staying too narrow limits authority. Topical borders define the optimal coverage zone.',
        kotoiq: 'The Topical Borders Detector agent flags content that may be diluting your authority by straying beyond your established topical boundaries.',
      },
      {
        name: 'Semantic Distance',
        desc: 'The conceptual distance between a search query and your content. Shorter semantic distance means your content more directly answers what the user is looking for — reducing the interpretive work the search engine must do.',
        kotoiq: 'Query-Document Alignment Scorer measures the semantic distance between your pages and their target queries, flagging misalignment before it costs rankings.',
      },
    ],
  },
  {
    id: 'contextual',
    name: 'Contextual Concepts',
    tag: 'CTX',
    subtitle: 'The layers of meaning that determine how search engines interpret and classify content',
    entries: [
      {
        name: 'Contextual Coverage',
        desc: 'The proportion of a webpage dedicated to relevant context. Every page communicates context through its content — contextual coverage measures how much of that context is aligned with the target topic versus noise.',
        kotoiq: 'KotoIQ\'s on-page analysis scores contextual coverage for every indexed page, highlighting sections that dilute topical focus.',
      },
      {
        name: 'Contextual Flow',
        desc: 'The processing order of information on a page and how it affects click satisfaction scores. The sequence in which you present concepts matters — search engines model how users consume content linearly.',
        kotoiq: 'The Context Aligner tab restructures content flow to match the information processing patterns that maximize engagement signals.',
      },
      {
        name: 'Contextual Hierarchy',
        desc: 'How typography, visuals, and layout adjust the weight of different content sections. H1s carry more contextual weight than body text. Bold text signals emphasis. Visual prominence creates semantic hierarchy beyond HTML structure.',
        kotoiq: 'Heading Vectors analysis maps your contextual hierarchy against top-ranking competitors to ensure proper weight distribution.',
      },
      {
        name: 'Contextual Border',
        desc: 'The transition boundary between macro-context and micro-context sections on a page. Where your page shifts from broad topic coverage to specific detail matters for how search engines segment and classify content.',
        kotoiq: 'Content briefs generated by KotoIQ include contextual border recommendations — where to transition from broad to specific coverage.',
      },
      {
        name: 'Contextual Bridge',
        desc: 'Connections between nodes in a topical map. Bridges are the semantic relationships that make internal links meaningful rather than arbitrary — they tell search engines why two pieces of content are related.',
        kotoiq: 'Internal Links analysis identifies where contextual bridges should exist and generates linking recommendations with contextual anchor text.',
      },
      {
        name: 'Contextual Domain',
        desc: 'The specific semantic setting where keywords and entities are interpreted. "Apple" means different things in technology, nutrition, and agriculture contexts — the contextual domain determines which meaning applies.',
        kotoiq: 'KotoIQ disambiguates keywords by contextual domain during analysis, ensuring your content targets the right semantic interpretation.',
      },
      {
        name: 'Contextual Layer',
        desc: 'A level of semantic meaning used for classification and ranking. Content operates at multiple contextual layers simultaneously — topic-level, entity-level, intent-level — and each layer contributes to how search engines classify the page.',
        kotoiq: 'Multi-layered contextual analysis runs across your content to ensure coverage at every semantic layer search engines evaluate.',
      },
      {
        name: 'Contextual Vector',
        desc: 'The consistent direction of meaning from start to finish in a document. A strong contextual vector means your page maintains semantic focus throughout — weak vectors indicate topic drift that confuses classification.',
        kotoiq: 'The Context Vector Aligner agent rewrites context paragraphs to maximize semantic relevance and maintain directional consistency.',
      },
      {
        name: 'Contextual Structure',
        desc: 'The integration of all contextual concepts — coverage, flow, hierarchy, borders, bridges, domains, layers, and vectors — into a coherent document that search engines can efficiently process and classify.',
        kotoiq: 'KotoIQ\'s content generation pipeline applies all contextual structure principles automatically during the Brief and Write phases.',
      },
    ],
  },
  {
    id: 'query',
    name: 'Query & Search Intelligence',
    tag: 'QRY',
    subtitle: 'How KotoIQ understands search behavior, query relationships, and user intent',
    entries: [
      {
        name: 'Query Semantics',
        desc: 'The meaning and intent behind queries, derived from query variations and search behaviors. A keyword is a string; query semantics is the universe of meaning that string carries across different users and contexts.',
        kotoiq: 'KotoIQ\'s SERP Intent Classifier decodes query semantics for every tracked keyword, mapping the full intent spectrum behind each query.',
      },
      {
        name: 'Query Network',
        desc: 'A search language representation showing word distributions across related queries. Query networks reveal how search engines group and relate different queries — essential for understanding which content satisfies multiple queries.',
        kotoiq: 'The Query Paths tab visualizes query networks from Search Console data, showing how users navigate between related searches.',
      },
      {
        name: 'Canonical Queries',
        desc: 'The root version of a search query. Every variation of a query — with different word order, modifiers, or phrasing — maps back to a canonical form that represents the fundamental search need.',
        kotoiq: 'Keyword deduplication and clustering in KotoIQ maps query variants to canonical forms, preventing content cannibalization.',
      },
      {
        name: 'Correlative Queries',
        desc: 'Queries that appear together within the same search session. When users search for A and B in the same session, those queries are correlative — your content should address both or link between them.',
        kotoiq: 'Query Path analysis surfaces correlative queries from session data, informing internal linking strategy and content expansion.',
      },
      {
        name: 'Sequential Queries',
        desc: 'Queries made in the same session representing evolving information needs. Users refine their searches — sequential query analysis reveals the journey from broad awareness to specific decision-making.',
        kotoiq: 'KotoIQ maps sequential query patterns to content funnels, ensuring your pages guide users through their natural search progression.',
      },
      {
        name: 'Query Aspect',
        desc: 'The prominent attributes or semantic angles within a query. "Best running shoes for flat feet" has aspects of comparison (best), product (running shoes), and condition (flat feet) — each aspect must be addressed.',
        kotoiq: 'Content briefs break target queries into aspects, ensuring generated content addresses every semantic angle the query carries.',
      },
      {
        name: 'Query Augmentation',
        desc: 'Expanding a query by adding context to improve retrieval. Search engines internally augment queries with contextual signals — understanding this helps you write content that matches augmented, not just literal, queries.',
        kotoiq: 'The Query Gap Analyzer identifies augmentation patterns for your target queries, revealing hidden content requirements.',
      },
      {
        name: 'Query Processing',
        desc: 'How search engines interpret, expand, and match queries to documents. Understanding query processing reveals why certain content ranks despite not containing exact keywords — semantic matching goes beyond string matching.',
        kotoiq: 'Query Term Weight Calculator scores each word in a query by importance under both lexical and BERT-based processing methods.',
      },
      {
        name: 'Information Responsiveness',
        desc: 'The combination of information quality and clarity. Responsive content doesn\'t just answer the question — it answers it completely, clearly, and in the format the user expects. Quality without clarity fails; clarity without quality fails.',
        kotoiq: 'KotoIQ\'s Safe Answer Generator crafts snippet-ready openings (40-60 words) optimized for both featured snippets and AI Overviews.',
      },
    ],
  },
  {
    id: 'entity',
    name: 'Entity & Knowledge Graph',
    tag: 'ENT',
    subtitle: 'How KotoIQ leverages entities, attributes, and structured knowledge for authority',
    entries: [
      {
        name: 'Entity-Attribute-Value (EAV)',
        desc: 'The data model structure that underpins knowledge graphs. Every entity has attributes, and every attribute has values — "Nike" (entity) has "headquarters" (attribute) with value "Beaverton, Oregon." Search engines think in EAV.',
        kotoiq: 'Entity Attribute Extractor agent analyzes entities in your content and structures them as root, rare, and unique attributes with prominence scoring.',
      },
      {
        name: 'Entity Connections',
        desc: 'The relationships between entities that form knowledge graphs. Isolated entities have limited value — connected entities demonstrate comprehensive understanding. Search engines evaluate how well you map the entity landscape.',
        kotoiq: 'Information Graph Builder creates arrow-based entity-relationship maps capturing connections and identifying missing variables in your content.',
      },
      {
        name: 'Rare Entities & Attributes',
        desc: 'Entity attributes that only some entities possess. While root attributes are universal (every company has a name), rare attributes differentiate — they signal deep knowledge that generic content misses.',
        kotoiq: 'Named Entity Suggester identifies rare entities and attributes that competitors miss, giving your content a knowledge-depth advantage.',
      },
      {
        name: 'Attribute Prominence',
        desc: 'How essential an attribute is to defining an entity. For a restaurant, "cuisine type" has high prominence; "parking lot color" has near-zero. Content should prioritize high-prominence attributes to align with how search engines model entities.',
        kotoiq: 'Entity analysis scores every attribute by prominence, ensuring content generation prioritizes the attributes that matter most for ranking.',
      },
      {
        name: 'Attribute Relevance',
        desc: 'How relevant an entity attribute is to your source context. A restaurant\'s "menu" attribute is highly relevant to a food review site but less relevant to a real estate site discussing neighborhood amenities.',
        kotoiq: 'Irrelevant Attribute Auditor flags entity attributes that don\'t align with your source context, keeping content focused and authoritative.',
      },
      {
        name: 'Named Entity Linking (NEL)',
        desc: 'Connecting entity mentions in text to entries in knowledge bases. When you mention "Tesla" in content, NEL determines whether you mean the company, the scientist, or the unit of measurement — and links to the correct knowledge base entry.',
        kotoiq: 'Named Entity Inserter enriches content by inserting missing but topically related entities, comparing topicality scores before and after insertion.',
      },
      {
        name: 'Knowledge Domain',
        desc: 'Specific areas encompassing particular queries, entities, layouts, and search patterns. A knowledge domain isn\'t just a topic — it\'s the complete ecosystem of how search engines organize and serve information about that topic.',
        kotoiq: 'Knowledge Domain Extractor generates structured glossaries with 100+ semantically relevant terms, definitions, and relationships for any target domain.',
      },
      {
        name: 'Knowledge Base',
        desc: 'A structured set of facts using EAV triples. Your content effectively builds a knowledge base that search engines can extract from — the clearer and more structured your facts, the more confidently search engines can use them.',
        kotoiq: 'Triple Generator converts content into subject-predicate-object triples with prominence scores — the building blocks of knowledge graphs.',
      },
    ],
  },
  {
    id: 'document',
    name: 'Document Architecture',
    tag: 'DOC',
    subtitle: 'How KotoIQ structures individual pages and content networks for maximum impact',
    entries: [
      {
        name: 'Root Document',
        desc: 'The central, independent page in a topical map that acts as a hub. Root documents don\'t depend on other pages for context — they define the topic and serve as the authority anchor for the entire content cluster.',
        kotoiq: 'Cornerstone Content Identifier detects which pages serve as root documents and where new hubs are needed in your content architecture.',
      },
      {
        name: 'Node Document',
        desc: 'Supporting pages that extend the root document\'s authority. Quality nodes rank on their own merits; non-quality nodes exist to fill coverage gaps and pass authority signals back to the root.',
        kotoiq: 'Topical Map engine classifies every page as a quality or non-quality node, informing content investment priorities.',
      },
      {
        name: 'Main Content vs. Supplementary Content',
        desc: 'Main content processes macro-context with context-terms, topical entries, and main entities. Supplementary content addresses micro-contexts and sub-topics. Both serve the page — but their roles in authority signaling differ.',
        kotoiq: 'On-page analysis separates main content from supplementary content, scoring each independently against topical requirements.',
      },
      {
        name: 'Semantic Content Brief',
        desc: 'A structured template for content creation that includes target queries, required entities, frame elements, contextual structure, and quality thresholds — everything a writer or AI needs to produce content that ranks.',
        kotoiq: 'KotoIQ Briefs inject intelligence from six pre-writing agents into every content brief: query gaps, frame semantics, named entities, lexical relations, safe answers, and title-query auditing.',
      },
      {
        name: 'Content Configuration',
        desc: 'The specific arrangement of content elements — headings, paragraphs, lists, tables, media — that best serves a particular query type. Different queries demand different configurations; one-size-fits-all templates fail.',
        kotoiq: 'Content generation adapts configuration based on SERP analysis — if top-ranking pages use tables, KotoIQ generates tables. If they use step-by-step guides, it generates guides.',
      },
      {
        name: 'Semantic HTML',
        desc: 'Using HTML elements for their semantic meaning, not just their visual appearance. \u003Carticle\u003E, \u003Csection\u003E, \u003Cnav\u003E, \u003Caside\u003E — these communicate document structure to search engines beyond what CSS classes can convey.',
        kotoiq: 'Semantic HTML Generator converts structured content into properly marked-up HTML with accessibility compliance and SEO optimization.',
      },
      {
        name: 'Connected Schema Markup',
        desc: 'Structured data that forms an interconnected graph rather than isolated snippets. Individual schema blocks are useful — connected schema that links entities, actions, and properties across pages is transformative.',
        kotoiq: 'Schema tab analyzes existing markup coverage, detects errors, and generates connected schema recommendations that build a site-wide entity graph.',
      },
      {
        name: 'Index Partitioning',
        desc: 'How search engines segment their index by content type, quality level, and topical domain. Understanding which partition your content falls into explains ranking behavior that keyword difficulty scores can\'t.',
        kotoiq: 'Technical audits evaluate indexation health and identify pages at risk of falling into lower-priority index partitions.',
      },
    ],
  },
  {
    id: 'lexical',
    name: 'Lexical Semantics',
    tag: 'LEX',
    subtitle: 'Word relationships and vocabulary patterns that signal depth of knowledge',
    entries: [
      {
        name: 'Lexical Semantics',
        desc: 'The study of word relationships and how meaning is constructed through vocabulary choices. In SEO, lexical semantics determines whether your content uses the precise vocabulary that search engines associate with expertise.',
        kotoiq: 'Lexical Relation Analyzer maps synonym, antonym, hypernym, hyponym, and meronym relationships for target topics.',
      },
      {
        name: 'Hypernyms & Hyponyms',
        desc: 'Hypernyms are broad category terms (color, vehicle, fruit). Hyponyms are specific instances (red, sedan, apple). Expert content naturally moves between specificity levels — generic content stays flat at one level.',
        kotoiq: 'Lexical Path Analyzer traces multi-step paths between terms, ensuring content demonstrates taxonomic depth through natural hypernym-hyponym usage.',
      },
      {
        name: 'Holonyms & Meronyms',
        desc: 'Holonyms denote the whole (face); meronyms denote parts (eyes, nose, mouth). Using meronyms demonstrates intimate knowledge of a subject — you know what something is made of, not just what it\'s called.',
        kotoiq: 'Entity Attribute Extractor identifies part-whole relationships in your target entities, ensuring content covers component structures.',
      },
      {
        name: 'N-Grams',
        desc: 'Sequences of N words that appear together in text. Unigrams (single words), bigrams (two-word phrases), trigrams (three-word phrases). N-gram analysis reveals the vocabulary patterns that characterize expert content in any niche.',
        kotoiq: 'N-gram Extractor analyzes competitor content and your own pages to identify the critical word sequences that signal topical expertise.',
      },
      {
        name: 'Skip-gram Dominant Words',
        desc: 'Words identified through word embedding models as frequently co-occurring. Skip-gram models predict context from a word — dominant words are the ones most powerfully associated with a topic across large text corpora.',
        kotoiq: 'Semantic analysis identifies skip-gram dominant words for your topics, ensuring content uses the vocabulary patterns search engines expect.',
      },
      {
        name: 'Macro Semantics',
        desc: 'Site-wide patterns: prevalent N-grams, dominant nouns, question formats, and context terms that define your site\'s overall semantic identity. Macro semantics tells search engines what your entire site is about.',
        kotoiq: 'Site-wide N-gram and heading pattern analysis surfaces your macro semantic signature and compares it against authority competitors.',
      },
      {
        name: 'Micro Semantics',
        desc: 'Word-by-word optimization through sequence modeling and visual optimization. Where macro semantics is about the forest, micro semantics is about each tree — the precision of individual word choices and their sequential impact.',
        kotoiq: 'Post-generation agents (Contextless Word Remover, Metadiscourse Auditor, Sentence Filterer) apply micro-semantic optimization to every piece of content.',
      },
    ],
  },
  {
    id: 'nlp',
    name: 'Natural Language Processing',
    tag: 'NLP',
    subtitle: 'The computational linguistics concepts that power KotoIQ\'s AI agents',
    entries: [
      {
        name: 'Natural Language Processing',
        desc: 'The AI discipline enabling computers to understand, interpret, and generate human language. NLP isn\'t just text analysis — it\'s the computational bridge between how humans express meaning and how machines process it.',
        kotoiq: 'Every KotoIQ agent uses NLP techniques — from tokenization and POS tagging to frame parsing and sentiment analysis — to process and generate content.',
      },
      {
        name: 'Sequence Modeling',
        desc: 'Analyzing how changing word sequences affects meaning and context. "Dog bites man" and "Man bites dog" use identical words but carry completely different meanings. Search engines model sequences, not just word bags.',
        kotoiq: 'Micro semantic optimization applies sequence modeling to ensure word order in titles, headings, and opening sentences maximizes relevance signals.',
      },
      {
        name: 'Semantic Triple',
        desc: 'The subject-predicate-object structure that forms the atomic unit of knowledge representation. "KotoIQ (subject) analyzes (predicate) semantic SEO (object)." Triples are how knowledge graphs store facts.',
        kotoiq: 'Triple Generator extracts S-P-O triples from content with prominence scoring — feeding directly into schema markup generation.',
      },
      {
        name: 'Frame Semantics',
        desc: 'Analyzing meaning through conceptual frameworks — life patterns, cultural contexts, and experiential knowledge. A "restaurant" frame includes ordering, eating, paying — content that activates the complete frame signals expertise.',
        kotoiq: 'Frame Semantics Analyzer maps the conceptual framework Google expects for any topic, identifying frame elements your content must address.',
      },
      {
        name: 'Semantic Role Labeling',
        desc: 'Identifying who did what to whom, when, where, and how — marking AGENT, PATIENT, EXPERIENCER, INSTRUMENT, and LOCATION in every clause. This reveals whether content is action-oriented or passive.',
        kotoiq: 'Semantic Role Labeler agent marks all semantic roles in content, ensuring active, clear writing that search engines can easily parse.',
      },
      {
        name: 'Annotational Semantics',
        desc: 'How layout, closeness, and order affect meaning. Content that appears in a sidebar carries different weight than main body content. Visual proximity between elements creates semantic associations.',
        kotoiq: 'On-page analysis considers annotational semantics — how your content\'s visual structure influences search engine interpretation.',
      },
      {
        name: 'Inquisitive Semantics',
        desc: 'Adding depth to content by asking and answering related questions. Expert content doesn\'t just state facts — it anticipates the questions those facts raise and addresses them. This creates the information density search engines reward.',
        kotoiq: 'Content briefs include question clusters derived from PAA data and query analysis, ensuring content addresses the full inquisitive landscape.',
      },
    ],
  },
  {
    id: 'semantic-theory',
    name: 'Semantic Theory',
    tag: 'SEM',
    subtitle: 'The theoretical foundations that inform KotoIQ\'s understanding of meaning and relevance',
    entries: [
      {
        name: 'Relevance',
        desc: 'Improves Information Retrieval Score through term-weight calculation. Relevance isn\'t binary — it\'s a spectrum measured by how closely your content\'s term weights align with the query\'s expected term weights.',
        kotoiq: 'Query-Document Alignment Scorer computes relevance as a multi-dimensional score, not a single keyword density metric.',
      },
      {
        name: 'Responsiveness',
        desc: 'Direct Information Extraction requiring answers that satisfy all possible search needs. A responsive page doesn\'t just mention the answer — it makes the answer immediately extractable by search engines and AI systems.',
        kotoiq: 'AEO scoring evaluates responsiveness across Format Match, Direct Answer quality, Schema Markup, Authority Signals, and Freshness.',
      },
      {
        name: 'Semantic Relevance',
        desc: 'Meaningful alignment between content and query intent — not just keyword matching. Semantic relevance considers entities, relationships, frames, and contextual signals to determine whether content truly addresses the user\'s need.',
        kotoiq: 'Topicality Scorer grades content 0-100 across five dimensions: Entity Coverage, Frame Coverage, Contextual Completeness, Heading Quality, and Information Gain.',
      },
      {
        name: 'Ontology',
        desc: 'A formal representation of knowledge as a set of concepts and their relationships within a domain. Ontologies define what exists in a topic space and how things relate — they\'re the blueprints search engines use to understand domains.',
        kotoiq: 'Topical Map generation is essentially ontology construction — mapping every concept, relationship, and hierarchy within your target domain.',
      },
      {
        name: 'Taxonomy',
        desc: 'The hierarchical classification of concepts from broad categories to specific instances. Taxonomy organizes knowledge into parent-child relationships that mirror how search engines classify and nest topics.',
        kotoiq: 'Topic Clusterer builds taxonomic structures from keyword lists, organizing them by semantic similarity and search behavior patterns.',
      },
      {
        name: 'Modality',
        desc: 'The degree of certainty, obligation, or possibility expressed in statements. "Is," "might be," "should be," and "must be" carry different modality — and search engines distinguish between facts, opinions, and recommendations.',
        kotoiq: 'Content quality agents evaluate modality in generated content, ensuring appropriate certainty levels for factual claims vs. recommendations.',
      },
      {
        name: 'Structural Semantics',
        desc: 'How sentence structure influences meaning. The grammatical arrangement of words creates semantic relationships that go beyond vocabulary — syntax carries meaning that search engines model through dependency parsing.',
        kotoiq: 'Syntax Tree Builder reveals grammatical structure through sentence, clause, and phrase parsing — creating dependency trees for content optimization.',
      },
    ],
  },
  {
    id: 'strategy',
    name: 'Search Strategy & Scoring',
    tag: 'STR',
    subtitle: 'KotoIQ\'s proprietary scoring models and strategic frameworks',
    entries: [
      {
        name: 'Opportunity Score',
        desc: 'KotoIQ\'s composite metric (0-100) for deciding which keywords deserve investment. Factors: search volume, conversion rate, rank gap vs. competitors, paid waste potential, and trend direction. Intent multipliers weight transactional queries higher.',
        kotoiq: 'Every keyword in KotoIQ\'s Unified Keyword Framework gets an Opportunity Score, automatically prioritizing where to invest content and ad budget.',
      },
      {
        name: 'Rank Propensity',
        desc: 'The realistic probability (0-100) of achieving a #1 ranking. Based on DA gap, current position, CTR signal strength, topical authority, content quality, Core Web Vitals, and page age. Some keywords are winnable; others aren\'t — yet.',
        kotoiq: 'Rank Propensity scores appear alongside every keyword, preventing wasted effort on queries where the authority gap is currently too large.',
      },
      {
        name: 'AEO Score',
        desc: 'Answer Engine Optimization readiness (0-100). As AI Overviews, Perplexity, and other AI systems consume web content, your pages need to be optimized for extraction, not just traditional ranking. Five dimensions: Format Match, Direct Answer, Schema, Authority, Freshness.',
        kotoiq: 'The AEO tab and Multi-Engine AEO Scorer evaluate your pages against Google AI Overviews, Perplexity, ChatGPT Search, and Copilot simultaneously.',
      },
      {
        name: 'E-E-A-T Score',
        desc: 'Experience, Expertise, Authority, Trust — the quality rater guidelines that inform search algorithms. KotoIQ scores each dimension independently: Experience 25%, Expertise 30%, Authority 25%, Trust 20%.',
        kotoiq: 'The E-E-A-T tab runs comprehensive audits scoring each dimension with specific, actionable recommendations for improvement.',
      },
      {
        name: 'AI Visibility Score',
        desc: 'Overall visibility across AI-powered search surfaces (0-100). Aggregates topical map coverage, E-E-A-T signals, brand SERP control, and AEO readiness into a single score that predicts your presence in the AI-first search future.',
        kotoiq: 'The Dashboard surfaces AI Visibility as a headline metric alongside traditional organic and paid performance.',
      },
      {
        name: 'Keyword Classification',
        desc: 'KotoIQ classifies every keyword into actionable categories: Organic Cannibals (ranking + paying — reduce waste), Striking Distance (position 4-15), Quick Wins (position 11-20 + high volume), Dark Matter (invisible opportunities), and Defend (protect top 3 positions).',
        kotoiq: 'The Keywords tab automatically classifies your portfolio, turning a flat keyword list into a prioritized action plan.',
      },
      {
        name: 'Content Decay',
        desc: 'The gradual loss of ranking and traffic as content ages without updates. Decay isn\'t random — it follows predictable patterns based on topic volatility, competitor activity, and freshness requirements. Predicting decay prevents traffic loss.',
        kotoiq: 'Content Decay tab predicts decay 30/60/90 days out using historical patterns, competitive pressure, and freshness signals — refresh before you drop.',
      },
      {
        name: 'Brand SERP',
        desc: 'Everything that appears when someone searches your brand name. Knowledge panels, People Also Ask, sitelinks, image packs, negative results — your brand SERP is your digital storefront, and every element can be influenced.',
        kotoiq: 'Brand SERP tab scans and monitors your branded search results, identifying negative results, missing knowledge panel attributes, and defense opportunities.',
      },
    ],
  },
]

const TOTAL = CATEGORIES.reduce((s, c) => s + c.entries.length, 0)

export default function KotoIQEncyclopediaPage() {
  usePageMeta({
    title: `KotoIQ Encyclopedia — ${TOTAL} Semantic SEO Concepts`,
    description: `The complete reference guide to the semantic SEO framework powering KotoIQ. ${TOTAL} concepts across ${CATEGORIES.length} domains — from topical authority to entity intelligence to AI visibility.`,
  })

  const navigate = useNavigate()
  const [activeFilter, setActiveFilter] = useState('all')
  const [expanded, setExpanded] = useState({})
  const [search, setSearch] = useState('')

  const toggle = (name) => setExpanded(e => ({ ...e, [name]: !e[name] }))

  const filtered = CATEGORIES
    .filter(c => activeFilter === 'all' || c.id === activeFilter)
    .map(c => ({
      ...c,
      entries: c.entries.filter(entry =>
        !search || entry.name.toLowerCase().includes(search.toLowerCase()) || entry.desc.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter(c => c.entries.length > 0)

  const visibleCount = filtered.reduce((s, c) => s + c.entries.length, 0)

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <PublicNav />

      {/* Hero */}
      <section className="enc-hero" style={{ background: W, padding: '180px 40px 100px', textAlign: 'center', position: 'relative' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div className="fade" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: T, fontFamily: FH, marginBottom: 18 }}>
            KotoIQ Intelligence Framework
          </div>
          <h1 className="enc-hero-h1 fade fade-1" style={{
            fontSize: 84, fontWeight: 900, fontFamily: FH,
            letterSpacing: '-.035em', lineHeight: 1.05,
            color: INK, maxWidth: 900, margin: '0 auto',
          }}>
            The Semantic SEO<br />
            <span style={{ color: R, fontSize: 'inherit', fontWeight: 'inherit', fontFamily: 'inherit', letterSpacing: 'inherit', lineHeight: 'inherit', display: 'inline' }}>Encyclopedia.</span>
          </h1>
          <p className="fade fade-2" style={{
            fontSize: 20, color: MUTED, fontFamily: FB,
            lineHeight: 1.55, maxWidth: 660, margin: '24px auto 0',
          }}>
            {TOTAL} concepts across {CATEGORIES.length} domains — the complete reference to the framework
            that powers KotoIQ's AI agents, content generation, and ranking intelligence.
          </p>
          <div className="fade fade-3" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 36 }}>
            <button className="btn btn-primary" onClick={() => navigate('/contact')}>
              See KotoIQ in action <ArrowRight size={16} />
            </button>
            <button className="btn btn-secondary" onClick={() => document.getElementById('encyclopedia')?.scrollIntoView({ behavior: 'smooth' })}>
              Explore the framework
            </button>
          </div>

          {/* Stats */}
          <div className="enc-stats" style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 48,
            maxWidth: 720, margin: '64px auto 0', textAlign: 'center',
          }}>
            {[
              { n: TOTAL, l: 'Concepts' },
              { n: CATEGORIES.length, l: 'Domains' },
              { n: '32', l: 'AI Agents' },
              { n: '21', l: 'Scoring Models' },
            ].map((s, i) => (
              <div key={i} className="fade" style={{ animationDelay: `${0.3 + i * 0.08}s` }}>
                <div style={{ fontSize: 36, fontWeight: 900, fontFamily: FH, color: INK, letterSpacing: '-.02em' }}>{s.n}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: FAINT, marginTop: 4, fontFamily: FB }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Search + Filter */}
      <section id="encyclopedia" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px 24px' }}>
        {/* Search */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20, position: 'relative' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 480 }}>
            <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: FAINT }} />
            <input
              className="search-input"
              type="text"
              placeholder="Search concepts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className={`pill ${activeFilter === 'all' ? 'active' : ''}`} onClick={() => setActiveFilter('all')}>All ({search ? visibleCount : TOTAL})</button>
          {CATEGORIES.map(c => {
            const count = search
              ? c.entries.filter(e => e.name.toLowerCase().includes(search.toLowerCase()) || e.desc.toLowerCase().includes(search.toLowerCase())).length
              : c.entries.length
            return (
              <button key={c.id} className={`pill ${activeFilter === c.id ? 'active' : ''}`} onClick={() => setActiveFilter(c.id)}>
                {c.name.split(' ')[0]} ({count})
              </button>
            )
          })}
        </div>
      </section>

      {/* Encyclopedia grid */}
      <section className="enc-pad" style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 40px 100px' }}>
        {filtered.map(cat => {
          const tagColor = TAG_COLORS[cat.tag] || T
          return (
            <div key={cat.id} id={cat.id} style={{ marginBottom: 56 }}>
              <div style={{ borderBottom: `2px solid ${INK}`, paddingBottom: 10, marginBottom: 20 }}>
                <h2 className="enc-sec-h2" style={{ fontSize: 44, fontWeight: 900, fontFamily: FH, color: INK, letterSpacing: '-.03em', margin: 0 }}>{cat.name}</h2>
                <p style={{ fontSize: 15, color: MUTED, marginTop: 6, fontFamily: FB }}>{cat.entries.length} concepts — {cat.subtitle}</p>
              </div>
              <div className="enc-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
                {cat.entries.map(entry => {
                  const isOpen = expanded[entry.name]
                  return (
                    <div key={entry.name} className="enc-card" style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 800, color: tagColor, background: tagColor + '14',
                          padding: '2px 7px', borderRadius: 4, letterSpacing: '.06em', fontFamily: FH,
                        }}>{cat.tag}</span>
                        <h3 style={{ fontSize: 16, fontWeight: 800, color: INK, margin: 0, fontFamily: FH }}>{entry.name}</h3>
                      </div>
                      <p style={{ fontSize: 14, color: '#4b5563', lineHeight: 1.55, fontFamily: FB, flex: 1, margin: '0 0 12px' }}>{entry.desc}</p>

                      <button
                        onClick={() => toggle(entry.name)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          fontSize: 12, fontWeight: 700, color: tagColor, background: 'none', border: 'none',
                          cursor: 'pointer', fontFamily: FH, padding: 0,
                        }}
                      >
                        {isOpen ? 'Hide KotoIQ application' : 'How KotoIQ applies this'}
                        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>

                      {isOpen && (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${HAIR}` }}>
                          {entry.formula && (
                            <div style={{
                              background: SURFACE, borderRadius: 8, padding: '10px 14px', marginBottom: 12,
                              fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: INK, letterSpacing: '.01em',
                            }}>
                              {entry.formula}
                            </div>
                          )}
                          <div style={{ fontSize: 10, fontWeight: 800, color: INK, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: FH, marginBottom: 6 }}>
                            Inside KotoIQ
                          </div>
                          <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.6, fontFamily: FB, margin: 0 }}>
                            {entry.kotoiq}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <p style={{ fontSize: 18, color: MUTED, fontFamily: FB }}>No concepts match your search.</p>
            <button
              className="btn btn-secondary"
              style={{ marginTop: 16 }}
              onClick={() => { setSearch(''); setActiveFilter('all') }}
            >
              Clear filters
            </button>
          </div>
        )}
      </section>

      {/* Attribution */}
      <section style={{ background: SURFACE, padding: '48px 40px', textAlign: 'center' }}>
        <p style={{ fontSize: 14, color: MUTED, fontFamily: FB, lineHeight: 1.7, maxWidth: 640, margin: '0 auto' }}>
          KotoIQ's semantic SEO framework is built on the pioneering work of Koray Tugberk GUBUR and the semantic SEO methodology.
          These concepts have been adapted, extended, and operationalized into KotoIQ's 32 AI agents and scoring models
          to deliver actionable intelligence — not just theory.
        </p>
      </section>

      {/* CTA */}
      <section style={{ background: INK, padding: '80px 40px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 44, fontWeight: 900, fontFamily: FH, color: W, letterSpacing: '-.03em', margin: 0 }}>
          Theory is free. Execution wins.
        </h2>
        <p style={{ fontSize: 18, color: FAINT, fontFamily: FB, lineHeight: 1.55, maxWidth: 560, margin: '16px auto 0' }}>
          KotoIQ turns every concept on this page into automated analysis, scoring, and content generation.
          Stop reading about semantic SEO — start executing it.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 32, flexWrap: 'wrap' }}>
          <button className="btn" style={{ background: R, color: W, padding: '15px 28px', fontSize: 15 }} onClick={() => navigate('/contact')}>
            Book a demo <ArrowRight size={16} />
          </button>
          <button className="btn" style={{ background: 'transparent', color: W, padding: '15px 28px', fontSize: 15, border: `1px solid ${FAINT}` }} onClick={() => navigate('/seo-agents')}>
            Explore all 32 agents <ArrowRight size={16} />
          </button>
        </div>
      </section>

      <PublicFooter />
    </>
  )
}
