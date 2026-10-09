// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlProvider } from 'react-intl'

const auth = { isIdentified: true, identityResolved: true, sessionVersion: 1 }
vi.mock('../widget-auth-provider', () => ({ useWidgetAuth: () => auth }))
vi.mock('@/lib/client/widget-auth', () => ({
  getWidgetAuthHeaders: () => ({ Authorization: 'Bearer widget-token' }),
}))

const getMyNameStatusFn = vi.fn()
const updateMyNameFn = vi.fn()
vi.mock('@/lib/server/functions/profile-name', () => ({
  getMyNameStatusFn: (...a: unknown[]) => getMyNameStatusFn(...a),
  updateMyNameFn: (...a: unknown[]) => updateMyNameFn(...a),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { WidgetNamePrompt } from '../widget-name-prompt'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <IntlProvider locale="en" messages={{}}>
        {children}
      </IntlProvider>
    </QueryClientProvider>
  )
}

describe('WidgetNamePrompt', () => {
  beforeEach(() => {
    sessionStorage.clear()
    getMyNameStatusFn.mockReset()
    updateMyNameFn.mockReset()
    auth.isIdentified = true
    auth.identityResolved = true
  })

  it('asks an identified visitor with no names, using the widget session', async () => {
    getMyNameStatusFn.mockResolvedValue({
      displayName: 'unknown',
      displayNameIsPlaceholder: true,
      givenName: null,
      familyName: null,
      needsName: true,
    })
    updateMyNameFn.mockResolvedValue({
      givenName: 'Ada',
      familyName: 'Lovelace',
      displayName: 'Ada Lovelace',
      entra: { status: 'updated' },
    })
    render(<WidgetNamePrompt />, { wrapper })

    await screen.findByRole('dialog')
    expect(getMyNameStatusFn).toHaveBeenCalledWith({
      headers: { Authorization: 'Bearer widget-token' },
    })

    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Ada' } })
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Lovelace' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(updateMyNameFn).toHaveBeenCalledTimes(1))
    expect(updateMyNameFn.mock.calls[0]![0]).toMatchObject({
      data: { givenName: 'Ada', familyName: 'Lovelace', displayName: 'Ada Lovelace' },
      headers: { Authorization: 'Bearer widget-token' },
    })
  })

  it('does not ask an anonymous visitor', async () => {
    auth.isIdentified = false
    render(<WidgetNamePrompt />, { wrapper })
    await new Promise((r) => setTimeout(r, 20))
    expect(getMyNameStatusFn).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
