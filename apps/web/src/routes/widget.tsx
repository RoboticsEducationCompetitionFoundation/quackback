import { createFileRoute, Outlet, redirect, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders, setResponseHeader } from '@tanstack/react-start/server'
import { z } from 'zod'
import { generateThemeCSS, readFontSans } from '@/lib/shared/theme'
import { resolveLocale, loadWidgetMessages } from '@/lib/shared/i18n'
import { WidgetAuthProvider } from '@/components/widget/widget-auth-provider'
import { WidgetNamePrompt } from '@/components/widget/widget-name-prompt'
import { extractSessionTokenFromCookie } from '@/lib/server/functions/portal-session-token'
import { fetchUserAvatar } from '@/lib/server/functions/portal'
import { redactSettingsForClient } from '@/lib/shared/redact-portal-config'
import { escapeInlineStyle } from '@/lib/shared/safe-inline-content'
import { Button } from '@/components/ui/button'
import { useBrandingFont } from '@/lib/client/hooks/use-branding-font'
import { isTeamMember } from '@/lib/shared/roles'

const setIframeHeaders = createServerFn({ method: 'GET' })
  .validator(z.object({ isolated: z.boolean() }))
  .handler(async ({ data }) => {
    setResponseHeader('Content-Security-Policy', 'frame-ancestors *')
    setResponseHeader('X-Frame-Options', 'ALLOWALL')
    // Lets a cross-origin-isolated host load this document at all.
    setResponseHeader('Cross-Origin-Resource-Policy', 'cross-origin')
    // Embedder policy only when the host is itself isolated (the SDK passes
    // ?coep=1): an isolated parent refuses to frame a document without one,
    // but with one the browser blocks every cross-origin image that doesn't
    // opt in — stored images served by redirect to the storage provider,
    // avatars, images in posts — so every other host goes without.
    if (data.isolated) setResponseHeader('Cross-Origin-Embedder-Policy', 'require-corp')
  })

/**
 * Resolve the widget locale on the server so SSR and hydration agree.
 * The `?locale=` search param wins over the Accept-Language header; both
 * are read server-side because navigator/URL access during render would
 * diverge from SSR and trigger React hydration error #418 (issue #133).
 */
const getWidgetLocale = createServerFn({ method: 'GET' })
  .validator(z.object({ explicitLocale: z.string().optional() }))
  .handler(async ({ data }) => {
    const acceptLanguage = getRequestHeaders().get('accept-language')
    return resolveLocale(acceptLanguage, data.explicitLocale)
  })

/** Extract the signed session cookie for direct widget session reuse (same-origin only). */
export const getPortalSessionToken = createServerFn({ method: 'GET' }).handler(async () => {
  const cookie = getRequestHeaders().get('cookie') ?? ''
  return extractSessionTokenFromCookie(cookie)
})

export const Route = createFileRoute('/widget')({
  // Render the widget on the client only. The iframe gets zero SEO value
  // from SSR, and skipping SSR HTML means there's no hydration step for a
  // CDN script-rewriter (Cloudflare Rocket Loader, Mirage, etc.) to break —
  // it makes the widget CDN-rewrite-proof for self-hosters on any CDN.
  // 'data-only' (not false): the loader must still run on the server so
  // setIframeHeaders() can set frame-ancestors/X-Frame-Options on the
  // document response, and the locale is resolved from Accept-Language.
  ssr: 'data-only',
  validateSearch: (
    search: Record<string, unknown>
  ): { locale?: string; theme?: 'light' | 'dark'; coep?: boolean } => ({
    locale: typeof search.locale === 'string' ? search.locale : undefined,
    // Set by the SDK when the host page is cross-origin isolated.
    coep: search.coep === 1 || search.coep === '1' || search.coep === true ? true : undefined,
    // Forces the widget document's theme regardless of visitor preference or
    // branding themeMode. Used by the admin settings preview's Light/Dark
    // toggle; resolved in __root so it never persists to the theme cookie.
    theme: search.theme === 'light' || search.theme === 'dark' ? search.theme : undefined,
  }),
  loader: async ({ context, location }) => {
    const { settings, session, userRole } = context

    const org = settings?.settings
    if (!org) {
      throw redirect({ to: '/onboarding' })
    }

    // Read the raw value too: the loader may see the parsed-but-unvalidated
    // search, where ?coep=1 is the number 1 rather than true.
    const coep = (location.search as Record<string, unknown>).coep
    await setIframeHeaders({ data: { isolated: coep === true || coep === 1 || coep === '1' } })

    const brandingData = settings.brandingData ?? null
    const brandingConfig = settings.brandingConfig ?? {}
    const customCss = settings.customCss ?? ''
    const themeMode = brandingConfig.themeMode ?? 'user'

    const hasThemeConfig = brandingConfig.light || brandingConfig.dark
    const themeStyles = hasThemeConfig ? generateThemeCSS(brandingConfig) : ''

    // If user is logged into the portal (same-origin), extract the signed
    // session cookie so the widget can reuse it directly as a Bearer token.
    // This prevents duplicate anonymous users and bypasses HMAC requirements.
    const portalUserBase =
      session?.user && session.user.principalType !== 'anonymous'
        ? {
            id: session.user.id,
            name: session.user.name,
            email: session.user.email,
            avatarUrl: session.user.image ?? null,
          }
        : null

    // location.search isn't generically typed inside the loader — cast to
    // the validateSearch shape, matching the pattern in _portal/index.tsx.
    const { locale: explicitLocale } = location.search as { locale?: string }

    // Extract the signed session cookie during SSR — this is the only point
    // where the cookie is available in cross-origin iframes (SameSite=Lax
    // sends cookies for the initial iframe navigation but NOT for subsequent
    // fetch/XHR from within the iframe). The token in the iframe's serialized
    // HTML is safe: cross-origin parent pages cannot read iframe content.
    // Independent of locale resolution, so run both concurrently.
    const [portalSessionToken, locale, portalAvatar] = await Promise.all([
      session?.user ? getPortalSessionToken() : Promise.resolve(null),
      getWidgetLocale({ data: { explicitLocale } }),
      portalUserBase
        ? fetchUserAvatar({
            data: { userId: portalUserBase.id, fallbackImageUrl: portalUserBase.avatarUrl },
          })
        : Promise.resolve(null),
    ])
    const portalUser = portalUserBase
      ? { ...portalUserBase, avatarUrl: portalAvatar?.avatarUrl ?? portalUserBase.avatarUrl }
      : null
    // Serialize the widget's catalog slice into loader data so the first
    // client render is already translated (the route is ssr: 'data-only' —
    // there's no SSR HTML to seed from).
    const messages = await loadWidgetMessages(locale)

    return {
      org: redactSettingsForClient(org),
      brandingData,
      themeMode,
      themeStyles,
      customCss,
      configFontSans: readFontSans(brandingConfig.light),
      portalUser,
      portalSessionToken,
      hmacRequired: settings?.publicWidgetConfig?.hmacRequired ?? false,
      // A teammate's own portal cookie reused in the widget must never be
      // handed off as a portal session — see WidgetAuthProvider.
      canPortalHandoff: !isTeamMember(userRole),
      isTeammate: isTeamMember(userRole),
      locale,
      messages,
    }
  },
  head: () => ({ meta: [] }),
  component: WidgetLayout,
  errorComponent: WidgetErrorComponent,
})

/**
 * Compact error fallback for the widget iframe. No marketing chrome or "Go
 * home" link — this renders inside a customer's embedded widget, so it's a
 * small centered message with a retry action.
 */
function WidgetErrorComponent() {
  const router = useRouter()

  return (
    <div className="flex min-h-[200px] items-center justify-center px-4">
      <div className="text-center">
        <p className="text-[13px] text-muted-foreground">Something went wrong.</p>
        <Button className="mt-3" size="sm" variant="outline" onClick={() => router.invalidate()}>
          Retry
        </Button>
      </div>
    </div>
  )
}

function WidgetLayout() {
  const {
    themeStyles,
    customCss,
    configFontSans,
    portalUser,
    portalSessionToken,
    hmacRequired,
    canPortalHandoff,
    isTeammate,
    locale,
    messages,
  } = Route.useLoaderData()

  // Widget documents render branding fonts the same way the portal does (the
  // custom CSS / theme config font-family cascades into the iframe below) —
  // load the chosen family on demand instead of shipping every self-hosted
  // family's @font-face rules to every embedded widget.
  useBrandingFont(customCss, configFontSans)

  return (
    <WidgetAuthProvider
      portalUser={portalUser}
      portalSessionToken={portalSessionToken}
      hmacRequired={hmacRequired}
      canPortalHandoff={canPortalHandoff}
      isTeammate={isTeammate}
      initialLocale={locale}
      initialMessages={messages}
    >
      {themeStyles && (
        <style dangerouslySetInnerHTML={{ __html: escapeInlineStyle(themeStyles) }} />
      )}
      {customCss && <style dangerouslySetInnerHTML={{ __html: escapeInlineStyle(customCss) }} />}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            body { overflow: hidden; margin: 0; }
            html, body, #root { height: 100%; }
            /* Prevent white flash before theme resolves */
            html.system { background: #fff; }
            @media (prefers-color-scheme: dark) {
              html.system { background: #09090b; }
            }
          `,
        }}
      />
      <Outlet />
      <WidgetNamePrompt />
    </WidgetAuthProvider>
  )
}
