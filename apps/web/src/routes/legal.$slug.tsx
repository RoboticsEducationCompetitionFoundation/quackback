import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import type { JSONContent } from '@tiptap/core'
import { getLegalDocumentFn } from '@/lib/server/functions/legal'
import { isLegalSlug, legalDocumentTitle } from '@/lib/shared/legal'
import { RichTextContent } from '@/components/ui/rich-text-content'
import { LegalFooter } from '@/components/shared/legal-footer'
import { generateThemeCSS, readFontSans } from '@/lib/shared/theme'
import { escapeInlineStyle } from '@/lib/shared/safe-inline-content'
import { useBrandingFont } from '@/lib/client/hooks/use-branding-font'

// Outside the portal layout so the documents stay readable on a private portal, and from the
// widget, without signing in. The workspace theme, custom CSS, and font are applied here the
// same way `_portal.tsx` does, so the pages match the rest of the site.
export const Route = createFileRoute('/legal/$slug')({
  loader: async ({ params, context }) => {
    if (!isLegalSlug(params.slug)) throw notFound()
    const content = await getLegalDocumentFn({ data: { slug: params.slug } })
    const settings = context.settings
    const brandingConfig = settings?.brandingConfig ?? {}
    const hasThemeConfig = brandingConfig.light || brandingConfig.dark
    return {
      slug: params.slug,
      content: content as JSONContent,
      workspaceName: settings?.name ?? 'RECF',
      logoUrl: settings?.brandingData?.logoUrl ?? null,
      faviconUrl: settings?.faviconData?.url || settings?.brandingData?.logoUrl || '/logo.png',
      themeStyles: hasThemeConfig ? generateThemeCSS(brandingConfig) : '',
      customCss: settings?.customCss ?? '',
      configFontSans: readFontSans(brandingConfig.light),
    }
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [{ title: `${legalDocumentTitle(loaderData.slug)} · ${loaderData.workspaceName}` }]
      : [],
    links: loaderData ? [{ rel: 'icon', href: loaderData.faviconUrl }] : [],
  }),
  component: LegalPage,
})

function LegalPage() {
  const { content, workspaceName, logoUrl, themeStyles, customCss, configFontSans } =
    Route.useLoaderData()
  useBrandingFont(customCss, configFontSans)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {themeStyles && (
        <style dangerouslySetInnerHTML={{ __html: escapeInlineStyle(themeStyles) }} />
      )}
      {customCss && <style dangerouslySetInnerHTML={{ __html: escapeInlineStyle(customCss) }} />}
      <header className="border-b border-border/50 px-4 py-3">
        <div className="mx-auto max-w-3xl">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm font-semibold text-foreground hover:underline"
          >
            {logoUrl && (
              <img
                src={logoUrl}
                alt=""
                className="h-8 w-8 [border-radius:calc(var(--radius)*0.6)]"
              />
            )}
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
