import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'KotoIQ AI Agents — 48 Semantic SEO Intelligence Agents',
  description: 'Explore KotoIQ\'s 48 AI agents across 8 domains: linguistic analysis, semantic extraction, entity intelligence, topical authority, sentiment processing, search quality auditing, performance analysis, and content optimization.',
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent data — 48 agents across 8 categories, mapped to KotoIQ's engine layer
// ─────────────────────────────────────────────────────────────────────────────

interface Agent {
  name: string
  icon: string
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

const CATEGORIES: Category[] = [
  {
    name: 'Linguistic & Syntactic Analysis',
    count: 8,
    subtitle: 'Agents that operate at sentence, word, and grammatical structure level',
    agents: [
      {
        name: 'Algorithmic Authorship Analyzer',
        icon: '🔍',
        description: 'Scans documents and identifies sentences that match problematic patterns — sentences starting with conditionals, unnecessary filler words, unclear nested statements, and more.',
        detects: [
          'Sentences starting with conditional clauses',
          'Unnecessary filler words (also, additionally, in addition to)',
          'Statements that should be questions but aren\'t written as questions',
          'Unclear nested statements reducing readability',
          'Plural nouns without supporting examples',
          'Claims stated without supporting reasons',
        ],
        useCases: ['Content editing', 'Proofreading', 'Document quality checks', 'Academic writing', 'Policy & technical review'],
        input: ['Blog posts', 'Landing page copy', 'Product descriptions', 'Category pages', 'Metadata (titles, meta descriptions)', 'Content briefs'],
      },
      {
        name: 'NLP Tokenizer & Lemmatizer',
        icon: '✂️',
        description: 'Parses text into a detailed NLP analysis table with tokens, lemmas, stems, POS tags, spelling suggestions, and dependency relations.',
        detects: [
          'Breaking text into ordered tokens with positions',
          'Generating lemmatized and stemmed word forms',
          'Assigning part-of-speech tags (NOUN, VERB, ADJ, etc.)',
          'Spelling suggestions for incorrect tokens',
          'Word sense and meaning in context',
          'Dependency relations (parent token and relation type)',
        ],
        useCases: ['SEO content analysis', 'NLP debugging', 'Keyword research', 'Annotation prep', 'Educational use'],
        input: ['Single sentences or headlines', 'Short paragraphs (5-300 words)', 'English prose without HTML or code'],
      },
      {
        name: 'Syntax Tree Builder',
        icon: '🌳',
        description: 'Reveals grammatical structure by parsing text into sentences, clauses, and phrases — creating syntax trees and dependency trees for content optimization.',
        detects: [
          'Parsing paragraphs into sentences, clauses, and phrases',
          'Identifying subjects, verbs, objects, and modifiers',
          'Creating hierarchical phrase structure trees (NP, VP, PP)',
          'Visualizing dependency relationships between words',
          'Core grammatical relations (nsubj, dobj, aux, advmod)',
          'How sentences are built and meaning is organized',
        ],
        useCases: ['SEO content refinement', 'Translation QA', 'NLP preprocessing', 'Technical writing', 'Syntax learning'],
        input: ['Single sentences', 'Short paragraphs', 'Blog posts', 'Landing page copy', 'Metadata'],
      },
      {
        name: 'Contextless Word Remover',
        icon: '🧹',
        description: 'Scans paragraphs and removes words that don\'t contribute to core meaning — stop words, vague fillers, redundant phrases, and wordy constructs.',
        detects: [
          'Stop words that add length but not value',
          'Vague fillers (some, one of the, a number of)',
          'Redundant phrases (is able to, in order to, due to the fact that)',
          'Wordy constructs that can be shortened',
          'Repeated ideas that don\'t add information',
          'Unnecessary hedging that weakens clarity',
        ],
        useCases: ['SEO editing', 'Conversion copy optimization', 'Content brief refinement', 'Metadata improvement', 'Report polishing'],
        input: ['Paragraphs with 2-3+ sentences', 'Plain text (30-800 words)', 'English prose without HTML'],
      },
      {
        name: 'Vocabulary Richness Auditor',
        icon: '📊',
        description: 'Measures how complex, varied, and readable language is by calculating sentence metrics, type/token ratios, syllable patterns, and readability scores.',
        detects: [
          'Sentence count and average sentence length',
          'Total tokens and unique word types',
          'Type/token ratio for vocabulary diversity',
          'Syllable patterns and readability levels',
          'Complex word percentage (3+ syllables)',
          'Overall vocabulary richness score',
        ],
        useCases: ['SEO content optimization', 'Content quality auditing', 'Brand voice consistency', 'Writer training', 'Localization checks'],
        input: ['Paragraphs with 2-3+ sentences', 'Plain text (30-800 words)', 'English prose'],
      },
      {
        name: 'Metadiscourse Markers Auditor',
        icon: '📑',
        description: 'Identifies metadiscourse markers that organize, connect, and explain discourse — frame markers, enumerative markers, result markers, and more.',
        detects: [
          'Frame markers that introduce or situate topics',
          'Enumerative markers that list or sequence components',
          'Result markers signaling consequences or outcomes',
          'Elaborative markers that clarify or restate ideas',
          'Interactive markers highlighting communal involvement',
        ],
        useCases: ['SEO content optimization', 'Content clarity & flow', 'Conversion copy tuning', 'Brand voice consistency', 'Content brief review'],
        input: ['Blog posts', 'Landing page copy', 'Product descriptions', 'Category pages', 'Content briefs (1-5 paragraphs)'],
      },
      {
        name: 'Question Logic Analyzer',
        icon: '❓',
        description: 'Analyzes questions and maps logical relationships between entities, breaking down connections step by step and discovering supporting entities.',
        detects: [
          'Entity-to-entity relationship mapping',
          'Step-by-step connection breakdowns',
          'Supporting entity discovery',
          'Relationship tables with relevance scoring',
          'Non-connection detection with explanations',
        ],
        useCases: ['Entity relationship analysis', 'SEO strategy', 'Content brief creation', 'Knowledge graph thinking', 'Problem diagnosis'],
        input: ['Clear questions with at least two entities', 'Optional context, goal, or constraints'],
      },
      {
        name: 'Context-Based Translator',
        icon: '🌍',
        description: 'Translates documents while preserving SEO context and topical relevance, adapting phrases naturally while keeping keywords recognizable.',
        detects: [
          'SEO term translation without losing search intent',
          'Natural phrase adaptation while preserving keywords',
          'Topical authority preservation across languages',
          'Context-based equivalents, not literal translation',
          'Consistent terminology across entire documents',
        ],
        useCases: ['SEO translation', 'Content localization', 'Metadata optimization', 'Topical authority building', 'Terminology consistency'],
        input: ['Blog posts', 'Landing pages', 'Product descriptions', 'Metadata', 'Primary keywords and target audience'],
      },
    ],
  },
  {
    name: 'Semantic Analysis & Meaning Extraction',
    count: 9,
    subtitle: 'Agents focused on meaning, roles, frames, and semantic relationships',
    agents: [
      {
        name: 'Frame Semantics Analyzer',
        icon: '🎯',
        description: 'Examines sentences and maps their meaning using frame semantics — identifying predicates, frame elements, and connecting surface syntax to semantic roles.',
        detects: [
          'Main predicates and which semantic frames they evoke',
          'Frame elements (Agent, Patient, Experiencer, Instrument, Goal)',
          'Core vs non-core frame element analysis',
          'Surface syntax to semantic role connections',
          'Predicate behavior comparison across domains',
        ],
        useCases: ['SEO content analysis', 'Content optimization', 'SERP analysis', 'Entity and schema strategy', 'Brand messaging consistency'],
        input: ['Blog posts', 'Landing page sections', 'Product descriptions', 'Metadata', 'Target keywords and user intent'],
      },
      {
        name: 'Semantic Role Labeler',
        icon: '🏷️',
        description: 'Analyzes sentences and marks who did what to whom, when, where, and how — identifying AGENT, PATIENT, EXPERIENCER, INSTRUMENT, LOCATION, and more.',
        detects: [
          'AGENT (doer of the action)',
          'PATIENT/THEME (entity affected)',
          'EXPERIENCER (entity that perceives)',
          'INSTRUMENT (what\'s used to carry out action)',
          'LOCATION, SOURCE, GOAL, TIME, MANNER',
          'Main predicate and semantic argument distinction',
        ],
        useCases: ['SEO content analysis', 'On-page optimization', 'Content brief refinement', 'Competitive teardown', 'Entity/knowledge graph prep'],
        input: ['Single sentences', 'Short paragraphs', 'Above-the-fold copy', 'Meta title + description pairs'],
      },
      {
        name: 'Word Meaning Extractor',
        icon: '💬',
        description: 'Identifies all possible meanings of each word, then highlights which meaning is actually used in context with entailment scoring.',
        detects: [
          'Every dictionary sense of each word',
          'Contextual entailment scores per meaning',
          'Best-fit sense identification',
          'Polysemous word handling with relevance ranking',
          'Separated contextual, prior, and total scores',
        ],
        useCases: ['Word-sense disambiguation', 'SEO keyword clarity', 'Semantic/NLP analysis', 'Copy review for precision', 'Linguistic education'],
        input: ['Single paragraphs', 'Article snippets', 'H1 + first paragraph', 'Sentence lists for ambiguous words'],
      },
      {
        name: 'Semantic Emphasizer',
        icon: '💡',
        description: 'Highlights the most semantically important concepts in text, creating summary tables with relevance and importance scores.',
        detects: [
          'Primary topic identification and analysis focus',
          'Key entities (people, places, things, concepts)',
          'Important attributes (qualities, features, metrics)',
          'Predicates and relationships (actions, cause-effect)',
          'Relevance and importance scoring per term',
        ],
        useCases: ['SEO content analysis', 'Topical authority mapping', 'Schema & structured data support', 'Content audits', 'Optimization planning'],
        input: ['Blog posts', 'Landing pages', 'Product descriptions', 'FAQ sections', 'Service pages'],
      },
      {
        name: 'Lexical Path Analyzer',
        icon: '🔀',
        description: 'Maps how concepts are lexically related — synonyms, antonyms, hypernyms, hyponyms — and traces multi-step lexical paths between terms.',
        detects: [
          'Synonyms, antonyms, hypernyms, hyponyms',
          'Multi-step lexical paths (e.g., cat → animal → living thing)',
          'Intermediate term connections between concepts',
          'Context notes for each relation',
          'Ambiguous term disambiguation via lexical neighborhoods',
        ],
        useCases: ['Topical mapping', 'Content clustering', 'Internal linking strategy', 'Entity enrichment', 'Keyword clarification'],
        input: ['Blog posts', 'Landing pages', 'Keyword lists', 'Entity lists', 'FAQ sections'],
      },
      {
        name: 'Triple Generator',
        icon: '🗃️',
        description: 'Converts paragraph meaning into structured subject-predicate-object triples with prominence scores — the building blocks of knowledge graphs.',
        detects: [
          'Subject-predicate-object relationship extraction',
          'Organized triple tables with prominence scoring',
          'Prominence score explanations per triple',
          'Main entities, actions, and facts identification',
        ],
        useCases: ['Knowledge graph building', 'Topical authority mapping', 'Schema planning', 'Competitive analysis', 'Brief validation'],
        input: ['Blog posts', 'Landing pages', 'Product descriptions', 'Metadata', 'Content briefs'],
      },
      {
        name: 'Relevant Item Finder',
        icon: '🎯',
        description: 'Pinpoints the single most topically relevant content unit for a given phrase, concept, or keyword — the precision targeting agent.',
        detects: [
          'Best-matching paragraph for a target keyword',
          'Most aligned list item for a user intent',
          'Semantically closest table entry to a concept',
          'Lexical relation mapping between phrase and content',
          'Contextual phrase insertion into selected content',
        ],
        useCases: ['Keyword targeting', 'Internal linking', 'Topical alignment', 'Content expansion', 'On-page SEO audits'],
        input: ['Blog posts', 'Landing pages', 'Product descriptions', 'One contextual phrase/keyword to match'],
      },
      {
        name: 'Knowledge Domain Extractor',
        icon: '📖',
        description: 'Generates structured glossaries with 100+ semantically relevant terms, definitions, importance scores, and entity relationships for any topic.',
        detects: [
          '100+ semantically relevant terms per topic',
          'Concise definitions in topic context',
          'Importance scoring per term',
          'Adjacent and neighboring context mapping',
          'Named entities and essential predicates per term',
        ],
        useCases: ['Topical map design', 'Entity-first SEO', 'Content briefing', 'Niche onboarding', 'Semantic clustering'],
        input: ['One clear topic name (e.g., "Technical SEO", "Local SEO for dentists")'],
      },
      {
        name: 'Entity Attribute Extractor',
        icon: '📦',
        description: 'Analyzes any entity type and extracts structured attributes: root (universal), rare (some entities), and unique (specific entities).',
        detects: [
          'Root attributes (present in all entities of a type)',
          'Rare attributes (present in some entities)',
          'Unique attributes (specific to individual entities)',
          'Attribute prominence and relevance scoring',
          'Example entity-to-attribute mapping',
        ],
        useCases: ['Entity schema design', 'Faceted navigation', 'Programmatic SEO templates', 'Competitive comparison pages', 'Taxonomy building'],
        input: ['Entity type to analyze (e.g., "SEO agency", "electric car")', 'Optional: business context, example entities'],
      },
    ],
  },
  {
    name: 'Entity & Knowledge Graph Intelligence',
    count: 8,
    subtitle: 'Agents focused on entities, attributes, and structured knowledge',
    agents: [
      {
        name: 'Named Entity Inserter',
        icon: '➕',
        description: 'Enriches paragraphs by inserting missing but topically related entities, explaining relevance and comparing topicality scores before and after.',
        detects: [
          'Important entities implied by heading but not mentioned',
          'Entity insertion that strengthens topical depth',
          'Before/after topicality score comparison',
          'New entity relevance explanations',
        ],
        useCases: ['Content enrichment', 'Topical authority building', 'On-page optimization', 'E-commerce SEO', 'Knowledge base docs'],
        input: ['A heading (H1/H2/H3)', 'Subordinate paragraph', 'Optional: target keywords, page type'],
      },
      {
        name: 'Named Entity Suggester',
        icon: '✨',
        description: 'Analyzes paragraphs and uncovers missing but contextually relevant entities, ranking them by prominence with related predicates and adjectives.',
        detects: [
          'Missing people, brands, places, events, concepts',
          'Prominence-ranked entity suggestions',
          'Entity attributes (type, role, category)',
          'Topical relevance explanations',
          'Related predicates and adjectives per entity',
        ],
        useCases: ['Content expansion', 'Topical authority building', 'Entity gap analysis', 'Internal linking strategy', 'On-page optimization'],
        input: ['Blog posts', 'Landing pages', 'Product descriptions', 'Metadata', 'Optional: main keyword/topic'],
      },
      {
        name: 'Person Entity Discoverer',
        icon: '👥',
        description: 'Takes two subjects and builds shared contextual domains by discovering key named entities with a focus on people — experts, researchers, founders.',
        detects: [
          'Key named entities connecting two subjects',
          'People focus (experts, influencers, researchers, founders)',
          'Shared contextual domains between concepts',
          'Bridge entities for content connections',
        ],
        useCases: ['Topical mapping', 'Content strategy', 'Digital PR & outreach', 'Internal linking', 'Expert sourcing'],
        input: ['Two main subjects or topics to connect', 'Optional: focus area or industry context'],
      },
      {
        name: 'Comparison Agent',
        icon: '❓',
        description: 'Helps decide "which one and why" when comparing tools, strategies, or concepts — with tailored comparisons based on your specific purpose.',
        detects: [
          'Structured tool/strategy/concept comparisons',
          'Purpose-tailored decision frameworks',
          'Clear pros/cons with recommendation reasoning',
        ],
        useCases: ['Product comparison', 'Technology choice', 'Strategy selection', 'Vendor evaluation', 'Plan/pricing decisions'],
        input: ['Two or more items to compare', 'Your specific purpose or use case', 'Optional: criteria, constraints'],
      },
      {
        name: 'Person Profile Builder',
        icon: '👤',
        description: 'Generates structured, context-rich profiles of people, linking them to their professional landscape with achievements and related figures.',
        detects: [
          'Structured biographical profiles',
          'Historical and professional landscape connections',
          'Achievement documentation',
          'Related figure identification',
        ],
        useCases: ['Biographical lookup', 'Thought-leadership mapping', 'Expert profiling', 'Historical placement', 'Career context analysis'],
        input: ['Person name', 'Optional: field of interest, time period, connection context'],
      },
      {
        name: 'Concept Explainer',
        icon: '❔',
        description: 'Creates consistent 8-sentence explanations for any concept with definitions, statistics, expert quotes, and related entity connections.',
        detects: [
          'Consistent 8-sentence structured explanations',
          'Definitions and core concepts',
          'Relevant statistics and data',
          'Expert quotes and entity connections',
        ],
        useCases: ['Concept glossaries', 'Documentation', 'Marketing & SEO glossaries', 'Educational content', 'Onboarding & training'],
        input: ['A "What is X?" question', 'Optional: audience level, domain context'],
      },
      {
        name: 'Information Graph Builder',
        icon: '⚖️',
        description: 'Analyzes documents and builds arrow-based entity-relationship maps capturing central entities, connections, and missing variables.',
        detects: [
          'Entity relationship mapping',
          'Arrow-based visual representations',
          'Missing variable identification',
          'Central entity and connection capture',
        ],
        useCases: ['Content modeling', 'Information architecture', 'Gap analysis', 'Knowledge graph design', 'Document analysis'],
        input: ['Documents, contracts, or policies', 'Terms and conditions', 'Structured or semi-structured text'],
      },
      {
        name: 'Irrelevant Attribute Auditor',
        icon: '❌',
        description: 'Scans entity-attribute lists and flags which attributes are actually relevant vs sensitive or unnecessary — essential for clean data and unbiased models.',
        detects: [
          'Irrelevant demographic attributes',
          'Sensitive or unnecessary attributes',
          'Business-relevant vs distracting attributes',
          'Relevance scoring per entity-attribute pair',
        ],
        useCases: ['Data cleaning', 'Bias auditing', 'ML feature review', 'Form & survey design', 'HR and hiring audits'],
        input: ['Entity-attribute tables', 'Bullet lists of entities', 'Schema or JSON descriptions', 'Field documentation'],
      },
    ],
  },
  {
    name: 'Topicality, Authority & Coverage Analysis',
    count: 7,
    subtitle: 'Agents that evaluate topic alignment, completeness, and authority signals',
    agents: [
      {
        name: 'Topicality Scorer',
        icon: '🎯',
        description: 'Evaluates how relevant a paragraph is to different topics by scoring each connection with contextual phrases and related entities.',
        detects: [
          'Paragraph relevance to multiple topics',
          'Topic connection scoring with contextual phrases',
          'Related entity identification per topic',
          'Comparative topicality analysis',
        ],
        useCases: ['SEO content auditing', 'Content planning', 'Competitor analysis', 'Brief validation', 'Topical alignment'],
        input: ['Paragraph or text to analyze', 'List of topics to score against', 'Optional: target keyword'],
      },
      {
        name: 'Bridge Topic Suggester',
        icon: '🌉',
        description: 'Analyzes site structure to uncover topical gaps and proposes new, relevant topics with SEO-friendly URLs to bridge them.',
        detects: [
          'Topical gaps in existing content',
          'New relevant topic proposals',
          'SEO-friendly URL suggestions',
          'Content expansion opportunities',
        ],
        useCases: ['Topical gap analysis', 'Content expansion', 'Site architecture planning', 'Internal linking strategy', 'Content roadmap'],
        input: ['Title tags and URL structures', 'Optional: competitor data, target niche'],
      },
      {
        name: 'Topic Clusterer',
        icon: '🌳',
        description: 'Takes keyword lists and automatically builds topical clusters with visualizations based on semantic similarity and search behavior.',
        detects: [
          'Topical cluster building from keywords',
          'Semantic similarity grouping',
          'Cluster relationship visualizations',
          'Search behavior pattern analysis',
        ],
        useCases: ['Keyword research organization', 'Topical authority planning', 'Content silo structure', 'Intent-based strategy', 'Cluster visualization'],
        input: ['Keyword lists', 'Optional: search volume data, target topic, desired cluster count'],
      },
      {
        name: 'Query Term Weight Calculator',
        icon: '🧮',
        description: 'Computes how important each term in a search query is under different processing methods — both lexical and BERT-based.',
        detects: [
          'Term importance for search queries',
          'Lexical vs BERT-based weight comparison',
          'Which terms matter most for ranking',
          'Query expansion opportunities',
        ],
        useCases: ['Query intent analysis', 'Keyword prioritization', 'Query expansion', 'Content strategy', 'Term importance ranking'],
        input: ['Search queries', 'Optional: target page context, industry context'],
      },
      {
        name: 'Title-Query Coverage Auditor',
        icon: '📏',
        description: 'Measures how well page titles cover their target queries with coverage ratio calculations — essential for metadata optimization.',
        detects: [
          'Title-to-query coverage ratios',
          'Coverage gap identification',
          'Optimization opportunities',
          'Metadata cleanup priorities',
        ],
        useCases: ['Content audits', 'On-page optimization', 'Migration QA', 'Metadata cleanup', 'Title optimization'],
        input: ['CSV with page titles and target queries', 'GSC export data', 'Optional: click/impression data'],
      },
      {
        name: 'Context Vector Aligner',
        icon: '⚡',
        description: 'Analyzes page context paragraphs and rewrites them to maximize semantic relevance to target search queries — sharpening your content vectors.',
        detects: [
          'Semantic relevance analysis',
          'Content rewriting for query alignment',
          'Semantic vector sharpening',
          'Entity enrichment and topic alignment',
        ],
        useCases: ['SEO intro optimization', 'Landing page relevance', 'Blog topic focus', 'Entity enrichment', 'Content rewriting'],
        input: ['Context paragraph or page intro', 'Target search query', 'Optional: page type, entities to preserve'],
      },
      {
        name: 'Context Paragraph Refresher',
        icon: '🔄',
        description: 'Revises existing text to become more context-rich and expert-level — adding definitions, statistics, expert quotes, and named entities.',
        detects: [
          'Text enrichment with definitions and context',
          'Statistical and data point addition',
          'Expert quote incorporation',
          'Named entity insertion for topical depth',
        ],
        useCases: ['SEO content refinement', 'Landing page optimization', 'B2B/technical content', 'E-E-A-T enhancement', 'Academic-style overviews'],
        input: ['Paragraph to refresh', 'Target topic or keyword', 'Optional: desired tone, specific entities'],
      },
    ],
  },
  {
    name: 'Sentiment, Opinion & Comment Processing',
    count: 2,
    subtitle: 'Agents focused on opinions, tone, and sentiment optimization',
    agents: [
      {
        name: 'Comment Sentiment Analyzer',
        icon: '💬',
        description: 'Analyzes multiple customer comments and generates structured sentiment summaries with pros, cons, and recurring themes.',
        detects: [
          'Structured sentiment summaries from reviews',
          'Pros and cons extraction',
          'Recurring theme identification',
          'Product comparison support data',
        ],
        useCases: ['Review mining', 'Product comparison', 'E-commerce optimization', 'Feature prioritization', 'Voice of customer analysis'],
        input: ['Multiple customer comments or reviews', 'Product or service name', 'Optional: specific aspects to analyze'],
      },
      {
        name: 'Sentiment Optimizer',
        icon: '❤️',
        description: 'Transforms reviews by softening emotional extremes and amplifying constructive positivity, with detailed before/after comparison tables.',
        detects: [
          'Emotional extreme softening',
          'Constructive positivity amplification',
          'Before/after comparison generation',
          'Authentic voice preservation',
        ],
        useCases: ['Review rewriting', 'Reputation management', 'Comment polishing', 'Support scripts', 'Social media moderation'],
        input: ['Review or comment to optimize', 'Optional: desired tone, brand voice guidelines'],
      },
    ],
  },
  {
    name: 'Search Quality & Algorithm Auditing',
    count: 5,
    subtitle: 'Agents that analyze content against search engine quality guidelines and algorithm updates',
    agents: [
      {
        name: 'Helpful Content Auditor',
        icon: '✅',
        description: 'Evaluates content against helpfulness, quality, originality, and trust criteria with scored audit tables — built for Google\'s Helpful Content standards.',
        detects: [
          'Helpfulness criteria evaluation',
          'Quality, originality, and trust scoring',
          'Original reporting and coverage depth',
          'AI-generated content pattern detection',
        ],
        useCases: ['Content quality checks', 'SEO content audits', 'Originality review', 'AI content screening', 'HCU recovery planning'],
        input: ['Content to audit', 'Optional: target keyword, competitor content'],
      },
      {
        name: 'Quality Update Impact Analyzer',
        icon: '📈',
        description: 'Maps traffic changes to specific Google algorithm updates with visualizations and impact analysis — essential for recovery diagnostics.',
        detects: [
          'Traffic-to-update correlation mapping',
          'Impact visualization generation',
          'Traffic forensics patterns',
          'Recovery opportunity identification',
        ],
        useCases: ['Traffic forensics', 'Update impact analysis', 'Visual reporting', 'Recovery diagnostics', 'Client communication'],
        input: ['Traffic data (GSC, GA export)', 'Date ranges covering update periods'],
      },
      {
        name: 'Spam Hit Detector',
        icon: '🐛',
        description: 'Analyzes SEO traffic data to detect whether a website was hit by specific Google spam or link spam updates — with forensic-level detail.',
        detects: [
          'Spam and link spam update impact signatures',
          'Traffic pattern anomalies from CSV data',
          'Specific update hit identification',
          'Recovery tracking over time',
        ],
        useCases: ['Traffic forensics', 'Ranking loss analysis', 'Client reporting', 'Recovery tracking', 'Penalty diagnosis'],
        input: ['SEO traffic data (CSV)', 'Date ranges covering suspected impact'],
      },
      {
        name: 'Publication Frequency Auditor',
        icon: '📅',
        description: 'Reads sitemaps and analyzes publishing patterns over time with charts, URL structure analysis, and editorial calendar insights.',
        detects: [
          'Publication frequency analysis',
          'Publishing pattern charts',
          'URL structure categorization',
          'Editorial calendar insights',
        ],
        useCases: ['Content auditing', 'Editorial planning', 'Site architecture analysis', 'Competitor research', 'Content velocity tracking'],
        input: ['Sitemap CSV with URLs and dates', 'Optional: competitor data'],
      },
      {
        name: 'Image Relevance Auditor',
        icon: '🖼️',
        description: 'Evaluates images for how well they match a given textual concept — checking visibility, entity identification, and topicality scores.',
        detects: [
          'Image-to-concept alignment scoring',
          'Subject visibility and clarity',
          'Entity identification within images',
          'Topicality and relevance scoring',
        ],
        useCases: ['SEO & content images', 'Ad creatives', 'E-commerce pages', 'Thumbnails & social posts', 'Image-text alignment'],
        input: ['Image to audit', 'Target concept or keyword', 'Optional: intended use'],
      },
    ],
  },
  {
    name: 'Data, Performance & Competitive Analysis',
    count: 4,
    subtitle: 'Agents that analyze datasets, metrics, and competitive signals',
    agents: [
      {
        name: 'Keyword Pattern Analyzer',
        icon: '📉',
        description: 'Scans SEO keyword datasets and identifies patterns — query lengths, brand mentions, correlations, question words, and FAQ opportunities.',
        detects: [
          'Query length and structure patterns',
          'Brand and company name detection',
          'Query property correlations',
          'Question word and FAQ opportunity extraction',
        ],
        useCases: ['Keyword research', 'Competitor gap analysis', 'Intent & topic mapping', 'FAQ discovery', 'Pattern recognition'],
        input: ['Keyword datasets (CSV)', 'Optional: search volume, competitor keywords'],
      },
      {
        name: 'Crawl Log Analyzer',
        icon: '📝',
        description: 'Processes crawl logs and reveals how Googlebot discovers your site — referrer URL visualizations, frequency tables, and crawl path analysis.',
        detects: [
          'Googlebot discovery patterns',
          'Referrer URL visualizations',
          'Crawl frequency analysis',
          'Internal linking effectiveness signals',
        ],
        useCases: ['Crawl behavior analysis', 'Internal linking evaluation', 'Content discovery insights', 'Crawl optimization', 'Bot behavior tracking'],
        input: ['Server log files with Googlebot requests', 'Optional: URL patterns, date ranges'],
      },
      {
        name: 'Outranking Cost Calculator',
        icon: '💰',
        description: 'Analyzes competitor SEO data and visualizes how difficult and costly it will be to outrank them — supporting budget decisions and ROI forecasting.',
        detects: [
          'Competitor difficulty and cost analysis',
          'Multi-metric outranking calculations',
          'Opportunity mapping and prioritization',
          'Budget forecasting data',
        ],
        useCases: ['Competitor analysis', 'SEO budgeting', 'Opportunity mapping', 'Client pitches', 'ROI forecasting'],
        input: ['Competitor SEO data (backlinks, DR, traffic)', 'Target keywords', 'Optional: your current metrics'],
      },
      {
        name: 'Backlink Profile Comparator',
        icon: '🔗',
        description: 'Compares two websites\' backlink profiles with domain rating visualizations, traffic correlations, and written comparison summaries.',
        detects: [
          'Backlink profile comparisons',
          'DR distribution visualizations',
          'Traffic-to-link correlations',
          'Written comparison summaries',
        ],
        useCases: ['Competitor backlink analysis', 'Link-building prioritization', 'Authority growth tracking', 'SEO reporting', 'Gap identification'],
        input: ['Backlink data for two websites', 'Ahrefs, Moz, or similar exports'],
      },
    ],
  },
  {
    name: 'Content Structure & Safe Generation',
    count: 5,
    subtitle: 'Agents that organize, summarize, validate, and generate content safely',
    agents: [
      {
        name: 'Key Fact Summarizer',
        icon: '📋',
        description: 'Extracts structured critical information from texts, ranking factual statements by prominence with named entities and attribute mapping.',
        detects: [
          'Structured critical information extraction',
          'Factual statement prominence ranking',
          'Named entity and attribute identification',
          'Competitive research fact extraction',
        ],
        useCases: ['SEO content analysis', 'Entity & attribute mapping', 'Content briefing', 'Competitive research', 'Key fact extraction'],
        input: ['Text to analyze', 'Optional: focus topics, entity count, output format'],
      },
      {
        name: 'Multi-Perspective Answer Generator',
        icon: '🛡️',
        description: 'Analyzes questions from multiple expert angles — customer, researcher, manufacturer — providing rich, safe, structured explanations.',
        detects: [
          'Multi-perspective question analysis',
          'Customer, researcher, manufacturer viewpoints',
          'Structured safe explanations',
          'Stakeholder-appropriate responses',
        ],
        useCases: ['Multi-angle SEO analysis', 'Strategy decision support', 'Stakeholder communication', 'Educational content', 'Safe content generation'],
        input: ['Question to analyze', 'Optional: perspectives, audience, constraints'],
      },
      {
        name: 'Footer Architecture Planner',
        icon: '🔗',
        description: 'Analyzes page metadata and content to propose SEO-friendly footer structures with contextual anchor texts and topical authority signals.',
        detects: [
          'SEO-friendly footer structure proposals',
          '5-column layout generation',
          'Contextual anchor text creation',
          'Topical authority support signals',
        ],
        useCases: ['Footer architecture', 'Internal linking', 'Topical authority', 'Redesign/migrations', 'Site navigation'],
        input: ['Current footer or sitemap', 'Page metadata', 'Optional: target keywords, competitor footers'],
      },
      {
        name: 'Semantic HTML Generator',
        icon: '💻',
        description: 'Converts mathematical formulas and structured data into semantic HTML with proper operators, accessibility compliance, and SEO optimization.',
        detects: [
          'Mathematical formula to semantic HTML conversion',
          'Proper element structure',
          'Accessibility compliance',
          'SEO-optimized output',
        ],
        useCases: ['Equation publishing', 'Accessibility', 'SEO optimization', 'Educational content', 'Technical documentation'],
        input: ['Mathematical formula or structured data', 'Optional: format preferences, accessibility requirements'],
      },
      {
        name: 'Product Specification Generator',
        icon: '📦',
        description: 'Generates 40+ structured product specifications ordered by decision-making importance — with definitions, measurement methods, and buyer-ready formatting.',
        detects: [
          '40+ structured product specifications',
          'Decision-making importance ordering',
          'Definitions and measurement methods',
          'Buyer guide and comparison readiness',
        ],
        useCases: ['Product research', 'Buyer guides', 'E-commerce optimization', 'Product management', 'Comparison pages'],
        input: ['Product name or type', 'Optional: category, spec count, focus areas'],
      },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const totalAgents = CATEGORIES.reduce((sum, c) => sum + c.agents.length, 0)

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid #e5e7eb', padding: '24px 0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 16 }}>K</div>
            <span style={{ fontSize: 20, fontWeight: 900, color: '#111', letterSpacing: '-0.02em' }}>KotoIQ</span>
          </div>
          <a href="https://hellokoto.com" style={{ fontSize: 14, fontWeight: 600, color: '#6b7280', textDecoration: 'none' }}>Back to Platform &rarr;</a>
        </div>
      </header>

      {/* Hero */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px 60px' }}>
        <div style={{ maxWidth: 720 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>AI-Powered SEO Intelligence</div>
          <h1 style={{ fontSize: 48, fontWeight: 900, color: '#111', lineHeight: 1.1, letterSpacing: '-0.03em', margin: 0 }}>
            {totalAgents} Semantic SEO Agents
          </h1>
          <p style={{ fontSize: 18, color: '#4b5563', lineHeight: 1.6, marginTop: 20, maxWidth: 600 }}>
            KotoIQ&apos;s agent layer orchestrates {totalAgents} specialized AI agents across {CATEGORIES.length} domains — from sentence-level linguistic analysis to knowledge graph intelligence to algorithm impact forensics. Each agent is purpose-built for a specific SEO task and can be composed into goal-driven workflows by the KotoIQ Strategist.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 32, flexWrap: 'wrap' }}>
            {CATEGORIES.map(c => (
              <a key={c.name} href={`#${c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} style={{
                padding: '6px 14px', borderRadius: 8, background: '#f3f4f6', fontSize: 13, fontWeight: 600,
                color: '#374151', textDecoration: 'none', whiteSpace: 'nowrap',
              }}>
                {c.name} <span style={{ color: '#9ca3af' }}>({c.count})</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 80px' }}>
        {CATEGORIES.map(category => (
          <div key={category.name} id={category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')} style={{ marginBottom: 60 }}>
            <div style={{ borderBottom: '2px solid #111', paddingBottom: 12, marginBottom: 24 }}>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: '#111', margin: 0, letterSpacing: '-0.02em' }}>{category.name}</h2>
              <p style={{ fontSize: 14, color: '#6b7280', margin: '6px 0 0' }}>{category.count} agents &mdash; {category.subtitle}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
              {category.agents.map(agent => (
                <div key={agent.name} style={{
                  background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px',
                  display: 'flex', flexDirection: 'column',
                }}>
                  {/* Agent header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                    <span style={{ fontSize: 28, lineHeight: 1 }}>{agent.icon}</span>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 800, color: '#111', margin: 0, lineHeight: 1.3 }}>{agent.name}</h3>
                      <p style={{ fontSize: 13, color: '#4b5563', margin: '6px 0 0', lineHeight: 1.5 }}>{agent.description}</p>
                    </div>
                  </div>

                  {/* What it detects */}
                  <div style={{ marginTop: 'auto' }}>
                    <details style={{ marginTop: 12 }}>
                      <summary style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', cursor: 'pointer', userSelect: 'none' }}>
                        What It Detects &middot; Use Cases &middot; Input
                      </summary>
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: 4 }}>Detects</div>
                        <ul style={{ margin: '0 0 10px', padding: '0 0 0 16px', fontSize: 12, color: '#4b5563', lineHeight: 1.6 }}>
                          {agent.detects.map((d, i) => <li key={i}>{d}</li>)}
                        </ul>

                        <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: 4 }}>Use Cases</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                          {agent.useCases.map((u, i) => (
                            <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#f3f4f6', color: '#374151' }}>{u}</span>
                          ))}
                        </div>

                        <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: 4 }}>Required Input</div>
                        <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 12, color: '#4b5563', lineHeight: 1.6 }}>
                          {agent.input.map((inp, i) => <li key={i}>{inp}</li>)}
                        </ul>
                      </div>
                    </details>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #e5e7eb', padding: '32px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: '#9ca3af' }}>
          KotoIQ by <a href="https://hellokoto.com" style={{ color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>Koto</a> &mdash; {totalAgents} agents, 3 orchestration goals, 22 registered tools, one unified SEO intelligence platform.
        </div>
      </footer>
    </div>
  )
}
