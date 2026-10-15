import { useSyncExternalStore } from 'react'

export type ConsentStatus = 'allow' | 'deny'

/** Same name as the Competition Control website's banner, so both Cookie Policies list it alike. */
export const CONSENT_COOKIE_NAME = 'cookieconsent_status'

const ONE_YEAR_SECONDS = 31536000

/** Carries a choice made in one tab to the others, since cookie writes fire no event. */
const SYNC_CHANNEL_NAME = 'cookie-consent'

export function parseConsentCookie(cookieHeader: string | null): ConsentStatus | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${CONSENT_COOKIE_NAME}=([^;]*)`))
  const value = match?.[1]
  return value === 'allow' || value === 'deny' ? value : null
}

let settingsOpen = false
const listeners = new Set<() => void>()
let detachSync: (() => void) | null = null

// Always read the cookie rather than caching it: it is shared across tabs, so a
// choice made elsewhere must be seen the next time anything here asks.
function currentStatus(): ConsentStatus | null {
  return parseConsentCookie(document.cookie)
}

function notify() {
  for (const listener of listeners) listener()
}

function broadcast(next: ConsentStatus) {
  if (typeof BroadcastChannel === 'undefined') return
  try {
    const channel = new BroadcastChannel(SYNC_CHANNEL_NAME)
    channel.postMessage(next)
    channel.close()
  } catch {
    // Sync is best-effort; the cookie is still re-read on focus.
  }
}

export function setConsent(next: ConsentStatus): void {
  const secure = window.location.protocol === 'https:' ? ';secure' : ''
  document.cookie = `${CONSENT_COOKIE_NAME}=${next};path=/;max-age=${ONE_YEAR_SECONDS};samesite=lax${secure}`
  settingsOpen = false
  notify()
  broadcast(next)
}

/** Reopens the banner so a visitor can change an earlier choice. */
export function openCookieSettings(): void {
  settingsOpen = true
  notify()
}

// Wakes idle tabs when the shared cookie changes: a message from the tab that
// changed it, or this tab regaining focus after a change made somewhere else.
function attachSync(): () => void {
  const onChange = () => notify()
  window.addEventListener('focus', onChange)
  window.addEventListener('pageshow', onChange)
  document.addEventListener('visibilitychange', onChange)
  let channel: BroadcastChannel | null = null
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(SYNC_CHANNEL_NAME)
      channel.onmessage = onChange
    } catch {
      channel = null
    }
  }
  return () => {
    window.removeEventListener('focus', onChange)
    window.removeEventListener('pageshow', onChange)
    document.removeEventListener('visibilitychange', onChange)
    channel?.close()
  }
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) detachSync = attachSync()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      detachSync?.()
      detachSync = null
    }
  }
}

// String snapshots compare by value. The server snapshot is 'pending' because only the browser
// reads the cookie here, so nothing consent-gated renders or runs before hydration.
type Snapshot = `${ConsentStatus | 'unset' | 'pending'}:${0 | 1}`

function getSnapshot(): Snapshot {
  return `${currentStatus() ?? 'unset'}:${settingsOpen ? 1 : 0}`
}

function getServerSnapshot(): Snapshot {
  return 'pending:0'
}

export function useCookieConsent(): {
  /** null until the visitor has chosen; 'pending' during SSR and hydration. */
  status: ConsentStatus | null | 'pending'
  settingsOpen: boolean
} {
  const [value, open] = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot).split(':')
  return {
    status: value === 'unset' ? null : (value as ConsentStatus | 'pending'),
    settingsOpen: open === '1',
  }
}
