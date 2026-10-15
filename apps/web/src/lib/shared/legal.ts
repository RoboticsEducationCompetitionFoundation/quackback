/**
 * The legal documents served at /legal/:slug. The text lives in src/legal/<slug>.md.
 */
export const LEGAL_DOCUMENTS = [
  { slug: 'terms-of-service', title: 'Terms and Conditions', shortTitle: 'Terms' },
  { slug: 'privacy-policy', title: 'Privacy Policy', shortTitle: 'Privacy' },
  { slug: 'acceptable-use-policy', title: 'Acceptable Use Policy', shortTitle: 'Acceptable Use' },
  { slug: 'cookie-policy', title: 'Cookie Policy', shortTitle: 'Cookies' },
] as const

export type LegalSlug = (typeof LEGAL_DOCUMENTS)[number]['slug']

export const LEGAL_SLUGS = LEGAL_DOCUMENTS.map((d) => d.slug) as [LegalSlug, ...LegalSlug[]]

export function isLegalSlug(value: string): value is LegalSlug {
  return (LEGAL_SLUGS as string[]).includes(value)
}

export function legalDocumentTitle(slug: LegalSlug): string {
  return LEGAL_DOCUMENTS.find((d) => d.slug === slug)!.title
}

/** Strips the front matter and the editorial HTML comments that precede each document's text. */
export function legalMarkdownBody(source: string): string {
  return source
    .replace(/\r\n?/g, '\n')
    .replace(/^---\n[\s\S]*?\n---\n/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim()
}
