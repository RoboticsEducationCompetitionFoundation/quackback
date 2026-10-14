import { useSyncExternalStore } from 'react'

export type ConsentStatus = 'allow' | 'deny'

/** Same name as the Competition Control website's banner, so both Cookie Policies list it alike. */
export const CONSENT_COOKIE_NAME = 'cookieconsent_status'

const ONE_YEAR_SECONDS = 31536000

export function parseConsentCookie(cookieHeader: string | null): ConsentStatus | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${CONSENT_COOKIE_NAME}=([^;]*)`))
  const value = match?.[1]
  return value === 'allow' || value === 'deny' ? value : null
}

let status: ConsentStatus | null | undefined
let settingsOpen = false
const listeners = new Set<() => void>()

function currentStatus(): ConsentStatus | null {
  if (status === undefined) status = parseConsentCookie(document.cookie)
  return status
}

function notify() {
  for (const listener of listeners) listener()
}

export function setConsent(next: ConsentStatus): void {
  const secure = window.location.protocol === 'https:' ? ';secure' : ''
  document.cookie = `${CONSENT_COOKIE_NAME}=${next};path=/;max-age=${ONE_YEAR_SECONDS};samesite=lax${secure}`
  status = next
  settingsOpen = false
  notify()
}

/** Reopens the banner so a visitor can change an earlier choice. */
export function openCookieSettings(): void {
  settingsOpen = true
  notify()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
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

/** Forgets the cached choice so the next read comes from document.cookie. */
export function resetCookieConsentForTests(): void {
  status = undefined
  settingsOpen = false
}
