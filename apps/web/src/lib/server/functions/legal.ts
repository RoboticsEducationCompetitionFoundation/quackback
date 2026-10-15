import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { LEGAL_SLUGS, legalMarkdownBody, type LegalSlug } from '@/lib/shared/legal'
import termsOfService from '@/legal/terms-of-service.md?raw'
import privacyPolicy from '@/legal/privacy-policy.md?raw'
import acceptableUsePolicy from '@/legal/acceptable-use-policy.md?raw'
import cookiePolicy from '@/legal/cookie-policy.md?raw'

const SOURCES: Record<LegalSlug, string> = {
  'terms-of-service': termsOfService,
  'privacy-policy': privacyPolicy,
  'acceptable-use-policy': acceptableUsePolicy,
  'cookie-policy': cookiePolicy,
}

/** Public: a legal document as TipTap JSON, for the read-only renderer. */
export const getLegalDocumentFn = createServerFn({ method: 'GET' })
  .validator(z.object({ slug: z.enum(LEGAL_SLUGS) }))
  .handler(async ({ data }) => {
    const { markdownToTiptapJson } = await import('@/lib/server/markdown-tiptap')
    return markdownToTiptapJson(legalMarkdownBody(SOURCES[data.slug]))
  })
