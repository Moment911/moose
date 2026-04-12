import 'server-only'
// ── Authoritative data source registry ──────────────────────────────────────
//
// This file is the single place that defines WHERE Koto fetches real-world
// data. Every fetch in the platform must resolve to one of these entries.
// If you need data that isn't in this registry, add the source here FIRST
// with a cited URL and rationale — then write the fetch logic.
//
// The "url" field may contain {PLACEHOLDER} tokens; use buildSourceUrl() to
// substitute them. Each entry also records which staleness threshold (from
// dataIntegrity.ts) applies to its payload so callers can mechanically build
// VerifiedDataSource records without guessing.
//
// Entries marked { broken: true } are known-not-working and are waiting on
// a fix. Do not build against them until the URL is verified with a live
// curl call. The rest of the registry has been manually verified against
// api.census.gov responses as of the creation date of this file.

import type { DataSourceType, StaleThresholdKey } from './dataIntegrity'

export interface DataSourceRegistryEntry {
  name: string
  url: string
  api_docs: string
  source_type: DataSourceType
  notes: string
  threshold_key: StaleThresholdKey
  broken?: true
}

export const DATA_SOURCES = {

  // ── GEOGRAPHIC — US Census Bureau ─────────────────────────────────────────

  us_states: {
    name: 'US Census Bureau — State List',
    url: 'https://api.census.gov/data/2020/dec/pl?get=NAME&for=state:*',
    api_docs: 'https://www.census.gov/data/developers/data-sets.html',
    source_type: 'government-federal',
    notes: '50 states + DC + territories. Free, no API key required for basic queries.',
    threshold_key: 'geo-state',
  },

  us_counties: {
    name: 'US Census Bureau — County List',
    url: 'https://api.census.gov/data/2020/dec/pl?get=NAME&for=county:*&in=state:{STATE_FIPS}',
    api_docs: 'https://www.census.gov/data/developers/data-sets.html',
    source_type: 'government-federal',
    notes: 'Replace {STATE_FIPS} with 2-digit FIPS (e.g. 12 for Florida). Returns all counties in a state.',
    threshold_key: 'geo-county',
  },

  us_places: {
    name: 'US Census Bureau — Places (Incorporated + CDPs)',
    url: 'https://api.census.gov/data/2020/dec/pl?get=NAME&for=place:*&in=state:{STATE_FIPS}',
    api_docs: 'https://www.census.gov/data/developers/data-sets.html',
    source_type: 'government-federal',
    notes: 'Authoritative list of US places. Includes both incorporated municipalities ("city", "town", "village") AND Census Designated Places ("CDP") which are unincorporated but geographically recognized. Callers that want only incorporated places should filter by the name suffix.',
    threshold_key: 'geo-municipality',
  },

  us_zip_codes: {
    name: 'US Census Bureau — ZIP Code Tabulation Areas (ZCTAs)',
    url: 'https://api.census.gov/data/2020/dec/pl?get=NAME&for=zip+code+tabulation+area:*&in=state:{STATE_FIPS}',
    api_docs: 'https://www.census.gov/data/developers/data-sets.html',
    source_type: 'government-federal',
    notes: 'ZCTAs are the census equivalent of ZIP codes (they lag actual USPS changes by ~5 years). For exact current USPS delivery ZIPs, cross-reference with USPS ZIP Code API.',
    threshold_key: 'geo-zip',
  },

  usps_zip_codes: {
    name: 'USPS ZIP Code Lookup API',
    url: 'https://tools.usps.com/zip-code-lookup.htm',
    api_docs: 'https://www.usps.com/business/web-tools-apis/',
    source_type: 'government-federal',
    notes: 'Free with registration. Cross-reference with Census ZCTAs for complete coverage. USPS is authoritative for active delivery ZIPs.',
    threshold_key: 'geo-zip',
  },

  // ── INDUSTRY CLASSIFICATIONS ──────────────────────────────────────────────

  naics_codes: {
    name: 'US Census Bureau — NAICS 2022 Reference',
    url: 'https://www.census.gov/naics/reference_files_tools/2022_NAICS_Descriptions.xlsx',
    api_docs: 'https://www.census.gov/naics/',
    source_type: 'government-federal',
    notes: 'NAICS reference data is distributed as a downloadable Excel file — no live JSON endpoint. The 2022 edition of the brief incorrectly pointed at /data/2022/cbp with NAICS2022_LABEL, which returns "unknown variable". Workaround: parse the XLSX at build time and ship a static JSON to /public/naics-2022.json, or use a mirror like naicslist.com (unofficial).',
    threshold_key: 'industry-naics',
    broken: true,
  },

  sic_codes: {
    name: 'OSHA SIC Code Manual',
    url: 'https://www.osha.gov/data/sic-manual',
    api_docs: 'https://www.osha.gov/data/sic-manual',
    source_type: 'government-federal',
    notes: 'Superseded by NAICS but still referenced by many business databases. HTML-only, no API.',
    threshold_key: 'industry-sic',
    broken: true, // no programmatic access
  },

  google_business_categories: {
    name: 'Google Business Profile Category List',
    url: 'https://mybusinessbusinessinformation.googleapis.com/v1/categories?regionCode=US&languageCode=en&view=FULL',
    api_docs: 'https://developers.google.com/my-business/reference/businessinformation/rest/v1/categories',
    source_type: 'google-api',
    notes: 'Requires OAuth access token. Google updates GBP categories frequently — always fetch live, never hardcode.',
    threshold_key: 'gbp-categories',
  },

  // ── BUSINESS DATA ─────────────────────────────────────────────────────────

  google_maps_places: {
    name: 'Google Maps Places API (Text Search)',
    url: 'https://maps.googleapis.com/maps/api/place/textsearch/json',
    api_docs: 'https://developers.google.com/maps/documentation/places/web-service/search-text',
    source_type: 'google-api',
    notes: 'Returns max ~60 results per query due to Google pagination limits. For large geographic areas, run multiple queries keyed off the verified municipality list from Census — never assume one query covers a whole county.',
    threshold_key: 'business-listing',
  },

  google_business_profile: {
    name: 'Google Business Profile API',
    url: 'https://mybusinessbusinessinformation.googleapis.com/v1/accounts',
    api_docs: 'https://developers.google.com/my-business/reference/businessinformation/rest',
    source_type: 'google-api',
    notes: 'Live GBP data. Always fetch fresh — never display cached GBP data as current.',
    threshold_key: 'gbp-live',
  },

  citation_directories: {
    name: 'Moz Local / BrightLocal Citation Source List',
    url: 'https://moz.com/local/citations',
    api_docs: 'https://brightlocal.com/local-search-results-checker/',
    source_type: 'third-party-verified',
    notes: 'Authoritative list of active citation directories. Do not hardcode — directories go offline and new ones emerge. Cross-reference both vendors.',
    threshold_key: 'citation-sources',
  },

} as const satisfies Record<string, DataSourceRegistryEntry>

export type DataSourceKey = keyof typeof DATA_SOURCES

export function getDataSource(key: DataSourceKey): DataSourceRegistryEntry {
  return DATA_SOURCES[key]
}

// Substitute {PLACEHOLDER} tokens in a source URL. Values are URL-encoded.
export function buildSourceUrl(key: DataSourceKey, params: Record<string, string>): string {
  let url: string = DATA_SOURCES[key].url
  for (const [k, v] of Object.entries(params)) {
    url = url.replace(`{${k}}`, encodeURIComponent(v))
  }
  return url
}
