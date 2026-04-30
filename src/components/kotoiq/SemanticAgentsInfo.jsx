"use client"
import { useState } from 'react'
import {
  Brain, Search, Frame, Type, Tag, Eraser, BarChart3, Filter, MessageSquare,
  ChevronDown, ChevronUp, ExternalLink
} from 'lucide-react'
import { R, T, BLK, GRY, GRN, AMB, FH, FB } from '../../lib/theme'

const AGENTS = [
  {
    name: 'Query Gap Analyzer',
    icon: Search,
    color: R,
    desc: 'Analyzes query networks to find the highest-value content angle with least competition',
  },
  {
    name: 'Frame Semantics Analyzer',
    icon: Frame,
    color: T,
    desc: 'Maps the conceptual structure search engines expect for your topic',
  },
  {
    name: 'Semantic Role Labeler',
    icon: Type,
    color: '#8b5cf6',
    desc: 'Optimizes sentence structure so your primary entity carries maximum relevance weight',
  },
  {
    name: 'Named Entity Suggester',
    icon: Tag,
    color: GRN,
    desc: 'Identifies brands, certifications, and technical terms that signal topical authority',
  },
  {
    name: 'Contextless Word Remover',
    icon: Eraser,
    color: AMB,
    desc: 'Strips filler and redundancy to increase semantic density and relevance scores',
  },
  {
    name: 'Topicality Scorer',
    icon: BarChart3,
    color: '#3b82f6',
    desc: 'Scores content coverage against topic requirements and competitor benchmarks',
  },
  {
    name: 'Algorithmic Authorship Filter',
    icon: Filter,
    color: '#ec4899',
    desc: 'Separates informative sentences from AI filler to ensure every line adds value',
  },
  {
    name: 'Safe Answer Generator',
    icon: MessageSquare,
    color: '#14b8a6',
    desc: 'Crafts featured-snippet-ready opening paragraphs optimized for AI Overviews',
  },
]

export default function SemanticAgentsInfo() {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{
      marginTop: 24,
      borderRadius: 14,
      border: '1px solid #e5e7eb',
      background: 'linear-gradient(135deg, #f8fafc 0%, #f0f9ff 50%, #faf5ff 100%)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: `linear-gradient(135deg, #ececef, #ececef)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Brain size={18} color={T} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 14, fontWeight: 800, color: BLK, letterSpacing: '-.01em' }}>
              Powered by 8 KotoAgenticIQ Intelligence Agents
            </div>
            <div style={{ fontSize: 11, color: '#1f1f22', marginTop: 1 }}>
              {expanded ? 'Click to collapse' : 'Learn how it works'}
            </div>
          </div>
        </div>
        {expanded
          ? <ChevronUp size={16} color="#9ca3af" />
          : <ChevronDown size={16} color="#9ca3af" />
        }
      </button>

      {/* Expandable content */}
      {expanded && (
        <div style={{ padding: '0 20px 20px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 12,
          }}>
            {AGENTS.map((agent) => {
              const Icon = agent.icon
              return (
                <div
                  key={agent.name}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 12,
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                    transition: 'box-shadow .15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                >
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: agent.color + '12',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={16} color={agent.color} />
                  </div>
                  <div>
                    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 13, fontWeight: 800, color: BLK, marginBottom: 3 }}>
                      {agent.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#1f1f22', lineHeight: 1.5 }}>
                      {agent.desc}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* SemanticsX link */}
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <a
              href="https://www.semanticsx.com/semantic-seo/ai-agents"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 12,
                color: T,
                fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              Learn more about Semantic SEO AI Agents <ExternalLink size={11} />
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
