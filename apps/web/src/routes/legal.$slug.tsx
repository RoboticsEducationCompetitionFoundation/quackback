import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import type { JSONContent } from '@tiptap/core'
import { getLegalDocumentFn } from '@/lib/server/functions/legal'
import { isLegalSlug, legalDocumentTitle } from '@/lib/shared/legal'
import { RichTextContent } from '@/components/ui/rich-text-content'
import { LegalFooter } from '@/components/shared/legal-footer'

// Outside the portal layout so the documents stay readable on a private portal, and from the
// widget, without signing in.
export const Route = createFileRoute('/legal/$slug')({
  loader: async ({ params, context }) => {
    if (!isLegalSlug(params.slug)) throw notFound()
    const content = await getLegalDocumentFn({ data: { slug: params.slug } })
    return {
      slug: params.slug,
      content: content as JSONContent,
      workspaceName: context.settings?.name ?? 'RECF',
    }
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [{ title: `${legalDocumentTitle(loaderData.slug)} · ${loaderData.workspaceName}` }]
      : [],
  }),
  component: LegalPage,
})

function LegalPage() {
  const { content, workspaceName } = Route.useLoaderData()

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/50 px-4 py-3">
        <div className="mx-auto max-w-3xl">
          <Link to="/" className="text-sm font-semibold text-foreground hover:underline">
            {workspaceName}
          </Link>
        </div>
      </header>
      <main className="flex-1 w-full px-4 py-8">
        <RichTextContent content={content} className="mx-auto max-w-3xl" />
      </main>
      <LegalFooter />
    </div>
  )
}
