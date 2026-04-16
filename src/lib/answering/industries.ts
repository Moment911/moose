/**
 * Industry registry. Loads the JSON templates in /src/data/answeringIndustries/
 * so server + seed code share the same source of truth.
 */
import hvac from '../../data/answeringIndustries/hvac.json'
import legal from '../../data/answeringIndustries/legal.json'
import medical from '../../data/answeringIndustries/medical.json'
import generic from '../../data/answeringIndustries/generic.json'
import type { Industry } from './llmConfigBuilder'

export const BUILTIN_INDUSTRIES: Industry[] = [hvac, legal, medical, generic] as unknown as Industry[]

export function getIndustryBySlug(slug: string): Industry | undefined {
  return BUILTIN_INDUSTRIES.find(i => i.slug === slug)
}

export function listIndustries(): Industry[] {
  return BUILTIN_INDUSTRIES
}
