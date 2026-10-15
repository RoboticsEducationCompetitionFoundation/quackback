'use client'

import { useEffect, useRef } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { parseConsentCookie, useCookieConsent } from '@/lib/client/cookie-consent'
import { useIsPublicSurface } from './cookie-consent-banner'

/**
 * Fires an anonymous pageview beacon on portal route changes (visitor
 * analytics). Waits for the visitor's cookie consent, honors the browser's
 * opt-out signals, restricts itself to portal routes, and dedupes re-renders
 * of the same URL. It sends no identifier — the server derives everything.
 */
const DEVICE_COOKIE = 'qb_device'

/** First-party durable device id (layer-2 identity, instance-opt-in). */
function getOrCreateDeviceId(): string | null {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${DEVICE_COOKIE}=([^;]+)`))
    if (match) return match[1]
    const id = crypto.randomUUID()
    document.cookie = `${DEVICE_COOKIE}=${id}; Max-Age=31536000; Path=/; SameSite=Lax`
    return id
  } catch {
    return null
  }
}

export function VisitorBeacon() {
  const href = useRouterState({ select: (s) => s.location.href })
  const isPublicSurface = useIsPublicSurface()
  const { status: consent } = useCookieConsent()
  const lastTracked = useRef<string | null>(null)

  useEffect(() => {
    if (consent === 'deny') {
      document.cookie = `${DEVICE_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`
    }
  }, [consent])

  useEffect(() => {
    if (consent !== 'allow' || !isPublicSurface || lastTracked.current === href) return
    // The cookie is shared across tabs; confirm it at send time rather than
    // trusting the value this tab last rendered with.
    if (parseConsentCookie(document.cookie) !== 'allow') return
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
    if (nav.doNotTrack === '1' || nav.globalPrivacyControl === true) return
    lastTracked.current = href

    const deviceId = getOrCreateDeviceId()
    const body = JSON.stringify({
      url: window.location.href,
      referrer: document.referrer,
      surface: 'portal',
      ...(deviceId ? { deviceId } : {}),
    })
    if (!navigator.sendBeacon?.('/api/track', body)) {
      fetch('/api/track', { method: 'POST', body, keepalive: true }).catch(() => {})
    }
  }, [href, isPublicSurface, consent])

  return null
}
