/**
 * Shared wildcard definitions for the Page Factory content engine.
 * Extracted from PageBuilderPage.jsx so both the legacy page builder
 * and the new content engine use the same field set.
 */

export interface WildcardField {
  key: string    // e.g. '{city}'
  label: string  // e.g. 'City'
  example: string
  section: string
  /** If true, auto-populated from Census/geo API at generation time */
  autoPopulate?: boolean
}

export const WILDCARD_SECTIONS = [
  {
    title: 'Location',
    fields: [
      { key: '{city}',         label: 'City',           example: 'Fort Lauderdale', autoPopulate: true },
      { key: '{state}',        label: 'State (abbr)',   example: 'FL',              autoPopulate: true },
      { key: '{state_full}',   label: 'State (full)',   example: 'Florida',         autoPopulate: true },
      { key: '{county}',       label: 'County',         example: 'Broward',         autoPopulate: true },
      { key: '{zip}',          label: 'ZIP Code',       example: '33301' },
      { key: '{region}',       label: 'Region',         example: 'South Florida' },
      { key: '{neighborhood}', label: 'Neighborhood',   example: 'Downtown' },
    ],
  },
  {
    title: 'Business',
    fields: [
      { key: '{business_name}', label: 'Business Name', example: 'Acme Co' },
      { key: '{phone}',         label: 'Phone',         example: '(555) 555-5555' },
      { key: '{email}',         label: 'Email',         example: 'info@business.com' },
      { key: '{address}',       label: 'Address',       example: '123 Main St' },
      { key: '{website}',       label: 'Website',       example: 'www.business.com' },
      { key: '{hours}',         label: 'Hours',         example: 'Mon-Fri 8am-6pm' },
      { key: '{founded}',       label: 'Year Founded',  example: '2015' },
      { key: '{owner_name}',    label: 'Owner Name',    example: 'John Smith' },
    ],
  },
  {
    title: 'Service',
    fields: [
      { key: '{service}',        label: 'Service',         example: 'Plumbing' },
      { key: '{service_plural}', label: 'Service (plural)', example: 'Plumbing Services' },
      { key: '{keyword}',        label: 'Keyword',         example: 'plumber near me' },
      { key: '{price_range}',    label: 'Price Range',     example: '$150-$500' },
      { key: '{response_time}',  label: 'Response Time',   example: 'same-day' },
      { key: '{year}',           label: 'Year',            example: new Date().getFullYear().toString() },
    ],
  },
  {
    title: 'Trust',
    fields: [
      { key: '{review_count}',       label: 'Review Count',       example: '150+' },
      { key: '{rating}',             label: 'Star Rating',        example: '4.9' },
      { key: '{certifications}',     label: 'Certifications',     example: 'Google Partner' },
      { key: '{unique_fact}',        label: 'Unique Local Fact',  example: 'a vibrant community' },
      { key: '{local_landmark}',     label: 'Local Landmark',     example: 'Las Olas Blvd' },
      { key: '{call_to_action}',     label: 'CTA Text',          example: 'Get a Free Audit' },
      { key: '{testimonial}',        label: 'Testimonial',        example: 'Best service ever!' },
      { key: '{testimonial_author}', label: 'Testimonial Author', example: 'Jane D.' },
      { key: '{nearby_city_1}',      label: 'Nearby City 1',     example: 'Hollywood',      autoPopulate: true },
      { key: '{nearby_city_2}',      label: 'Nearby City 2',     example: 'Pompano Beach',   autoPopulate: true },
      { key: '{nearby_city_3}',      label: 'Nearby City 3',     example: 'Dania Beach',     autoPopulate: true },
      { key: '{service_radius}',     label: 'Service Radius',    example: '25 miles' },
      { key: '{population}',         label: 'Population',        example: '183,000',         autoPopulate: true },
      { key: '{license_number}',     label: 'License Number',    example: 'LIC-123456' },
      { key: '{warranty}',           label: 'Warranty',          example: '2-year warranty' },
      { key: '{guarantee}',          label: 'Guarantee',         example: '100% satisfaction guaranteed' },
      { key: '{payment_methods}',    label: 'Payment Methods',   example: 'Cash, Card, Financing' },
      { key: '{financing}',          label: 'Financing',         example: '0% financing available' },
    ],
  },
  {
    title: 'Local Context',
    fields: [
      { key: '{local_problem}',  label: 'Local Problem',  example: 'hard water issues' },
      { key: '{local_solution}', label: 'Local Solution',  example: 'our water treatment systems' },
      { key: '{seasonal_hook}',  label: 'Seasonal Hook',   example: 'With Florida summers...' },
    ],
  },
] as const

export type WildcardKey = typeof WILDCARD_SECTIONS[number]['fields'][number]['key']

export const ALL_WILDCARDS: WildcardField[] = WILDCARD_SECTIONS.flatMap(s =>
  s.fields.map(f => ({ ...f, section: s.title }))
)

export const AUTO_POPULATE_KEYS = ALL_WILDCARDS
  .filter(w => w.autoPopulate)
  .map(w => w.key)

/** Replace all {wildcard} tokens in a string with values from the map */
export function fillWildcards(text: string, values: Record<string, string>): string {
  return text.replace(/\{[a-z_0-9]+\}/g, match => values[match] ?? match)
}

/** Build a default values map from example values */
export function buildDefaultValues(): Record<string, string> {
  const map: Record<string, string> = {}
  ALL_WILDCARDS.forEach(w => { map[w.key] = w.example })
  return map
}
