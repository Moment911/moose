import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'

// ── Parse git log into structured changelog entries ─────────────────────────
function parseCommits(limit: number = 100): any[] {
  try {
    const raw = execSync(
      `git log --pretty=format:'%H|||%h|||%s|||%an|||%ai|||%b' -n ${limit}`,
      { cwd: process.cwd(), encoding: 'utf-8', timeout: 10000 }
    )
    return raw.split('\n').filter(Boolean).map(line => {
      const [hash, short, subject, author, date, body] = line.split('|||')
      // Parse conventional commit format
      const typeMatch = subject.match(/^(feat|fix|refactor|docs|chore|style|perf|test|build|ci)(?:\(([^)]+)\))?:\s*(.+)/)
      const type = typeMatch?.[1] || 'update'
      const scope = typeMatch?.[2] || null
      const title = typeMatch?.[3] || subject

      // Convert type to plain English
      const typeLabels: Record<string, string> = {
        feat: 'New Feature',
        fix: 'Bug Fix',
        refactor: 'Improvement',
        docs: 'Documentation',
        chore: 'Maintenance',
        style: 'Visual Update',
        perf: 'Performance',
        test: 'Testing',
        build: 'Build',
        ci: 'Deployment',
        update: 'Update',
      }

      // Convert scope to readable module name
      const scopeLabels: Record<string, string> = {
        answering: 'Answering Service',
        marketing: 'Marketing Site',
        demos: 'Live Demos',
        inbound: 'Inbound Calls',
        voice: 'Voice Agents',
      }

      return {
        hash: short,
        full_hash: hash,
        type,
        type_label: typeLabels[type] || 'Update',
        scope: scope ? (scopeLabels[scope] || scope) : null,
        title: title.trim(),
        description: body?.trim() || null,
        author: author?.trim(),
        date: date?.trim(),
        date_formatted: date ? new Date(date.trim()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null,
        date_relative: date ? getRelativeTime(new Date(date.trim())) : null,
      }
    })
  } catch {
    return []
  }
}

function getRelativeTime(date: Date): string {
  const now = Date.now()
  const diff = now - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

// Group commits by date
function groupByDate(commits: any[]): Record<string, any[]> {
  const groups: Record<string, any[]> = {}
  for (const c of commits) {
    const day = c.date ? new Date(c.date).toISOString().split('T')[0] : 'unknown'
    if (!groups[day]) groups[day] = []
    groups[day].push(c)
  }
  return groups
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action, limit, type_filter, search } = body

  if (action === 'list') {
    let commits = parseCommits(limit || 200)

    // Filter by type
    if (type_filter && type_filter !== 'all') {
      commits = commits.filter(c => c.type === type_filter)
    }

    // Search
    if (search) {
      const q = search.toLowerCase()
      commits = commits.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.scope?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q)
      )
    }

    const grouped = groupByDate(commits)

    // Stats
    const stats = {
      total: commits.length,
      features: commits.filter(c => c.type === 'feat').length,
      fixes: commits.filter(c => c.type === 'fix').length,
      improvements: commits.filter(c => c.type === 'refactor' || c.type === 'perf').length,
      last_update: commits[0]?.date_formatted || null,
    }

    return NextResponse.json({ commits, grouped, stats })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
