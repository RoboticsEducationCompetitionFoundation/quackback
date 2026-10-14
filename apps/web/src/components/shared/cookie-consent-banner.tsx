import { Link, useRouterState } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { setConsent, useCookieConsent } from '@/lib/client/cookie-consent'

const PUBLIC_SURFACE_ROUTE_PREFIXES = ['/_portal', '/changelog', '/hc', '/help', '/legal']

/**
 * Public visitor-facing surfaces: the portal tree, the standalone changelog and help-center trees
 * (the latter also serve the subdomain), and the legal pages. The widget iframe and admin are not.
 */
export function useIsPublicSurface(): boolean {
  return useRouterState({
    select: (s) =>
      s.matches.some((m) =>
        PUBLIC_SURFACE_ROUTE_PREFIXES.some((prefix) => m.routeId.startsWith(prefix))
      ),
  })
}

/** Asks for consent to non-essential cookies on public pages, and again from Cookie Settings. */
export function CookieConsentBanner() {
  const isPublicSurface = useIsPublicSurface()
  // The admin branding preview frames the portal; the banner would only cover it there.
  const isPreview = useRouterState({
    select: (s) => (s.location.search as { preview?: unknown }).preview === true,
  })
  const { status, settingsOpen } = useCookieConsent()

  if (!isPublicSurface || isPreview || status === 'pending') return null
  if (status !== null && !settingsOpen) return null

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4 pointer-events-none"
    >
      <div className="pointer-events-auto mx-auto flex max-w-3xl flex-col gap-3 rounded-lg border border-border bg-card p-4 text-sm text-card-foreground shadow-lg sm:flex-row sm:items-center">
        <p className="flex-1">
          We use cookies that are needed for this site to work. With your permission, we also use
          analytics cookies to understand how the site is used.{' '}
          <Link
            to="/legal/$slug"
            params={{ slug: 'cookie-policy' }}
            className="underline underline-offset-2 hover:text-foreground"
          >
            Cookie Policy
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => setConsent('deny')}>
            Decline
          </Button>
          <Button size="sm" onClick={() => setConsent('allow')}>
            Allow
          </Button>
        </div>
      </div>
    </div>
  )
}
