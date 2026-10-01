import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock getRequestHeaders before importing the module under test
const mockGet = vi.fn()
vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: () => ({ get: mockGet }),
}))

// Mock db
const mockSessionFindFirst = vi.fn()

vi.mock('@/lib/server/db', () => ({
  db: {
    query: {
      session: { findFirst: (...args: unknown[]) => mockSessionFindFirst(...args) },
    },
  },
  session: { token: 'token', expiresAt: 'expiresAt', userId: 'userId' },
  principal: { userId: 'userId' },
  eq: vi.fn(),
  and: vi.fn(),
  gt: vi.fn(),
}))

// Principal resolution is the factory's job (read-first, race-safe insert);
// here we only care that widget-auth hands it the session user and presents
// whatever it returns at widget tier.
const mockEnsurePrincipal = vi.fn()
vi.mock('@/lib/server/domains/principals/principal.factory', () => ({
  ensurePrincipalForUser: (...args: unknown[]) => mockEnsurePrincipal(...args),
}))

// Mock workspace settings
vi.mock('@/lib/server/functions/workspace', () => ({
  getSettings: vi.fn(() => ({
    id: 'ws_123',
    slug: 'acme',
    name: 'Acme Inc',
  })),
}))

vi.mock('@/lib/server/storage/s3', () => ({
  getPublicUrlOrNull: vi.fn((key: string | null | undefined) =>
    key ? `https://cdn.example/${key}` : null
  ),
}))

import { getWidgetSession } from '../widget-auth'

describe('getWidgetSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return null when no Authorization header', async () => {
    mockGet.mockReturnValue(null)

    const result = await getWidgetSession()
    expect(result).toBeNull()
  })

  it('should return null when Authorization header is not Bearer', async () => {
    mockGet.mockReturnValue('Basic abc123')

    const result = await getWidgetSession()
    expect(result).toBeNull()
  })

  it('should return null when token is empty after Bearer', async () => {
    mockGet.mockReturnValue('Bearer ')

    const result = await getWidgetSession()
    expect(result).toBeNull()
  })

  it('should return null when session not found', async () => {
    mockGet.mockReturnValue('Bearer valid-token-123')
    mockSessionFindFirst.mockResolvedValue(null)

    const result = await getWidgetSession()
    expect(result).toBeNull()
  })

  it('should return null when session has no user', async () => {
    mockGet.mockReturnValue('Bearer valid-token-123')
    mockSessionFindFirst.mockResolvedValue({ userId: 'user_1', user: null })

    const result = await getWidgetSession()
    expect(result).toBeNull()
  })

  it('normalizes the signed bearer form to the raw token for the lookup', async () => {
    // The auth library's set-auth-token header carries `<token>.<signature>`;
    // the DB stores the raw token, so the lookup must use the prefix.
    mockGet.mockReturnValue('Bearer raw-token-123.c2lnbmF0dXJl')
    mockSessionFindFirst.mockResolvedValue({
      userId: 'user_1',
      user: { id: 'user_1', email: 'jane@acme.com', name: 'Jane', image: null },
    })
    mockEnsurePrincipal.mockResolvedValue({
      principal: { id: 'principal_1', role: 'user', type: 'anonymous' },
      created: false,
    })

    const result = await getWidgetSession()

    const { eq } = await import('@/lib/server/db')
    expect(eq).toHaveBeenCalledWith('token', 'raw-token-123')
    expect(result).not.toBeNull()
  })

  it('should return auth context for valid session with existing principal', async () => {
    mockGet.mockReturnValue('Bearer valid-token-123')
    mockSessionFindFirst.mockResolvedValue({
      userId: 'user_1',
      user: { id: 'user_1', email: 'jane@acme.com', name: 'Jane', image: 'https://avatar.url' },
    })
    mockEnsurePrincipal.mockResolvedValue({
      principal: { id: 'principal_1', role: 'user', type: 'user' },
      created: false,
    })

    const result = await getWidgetSession()

    expect(result).toEqual({
      settings: { id: 'ws_123', slug: 'acme', name: 'Acme Inc' },
      user: { id: 'user_1', email: 'jane@acme.com', name: 'Jane', image: 'https://avatar.url' },
      principal: { id: 'principal_1', role: 'user', type: 'user' },
      canPortalHandoff: true,
    })
  })

  it('lazily creates the principal from the session user when none exists', async () => {
    mockGet.mockReturnValue('Bearer valid-token-123')
    mockSessionFindFirst.mockResolvedValue({
      userId: 'user_1',
      user: { id: 'user_1', email: 'jane@acme.com', name: 'Jane', image: null },
    })
    mockEnsurePrincipal.mockResolvedValue({
      principal: { id: 'principal_mock123', role: 'user', type: 'user' },
      created: true,
    })

    const result = await getWidgetSession()

    expect(mockEnsurePrincipal).toHaveBeenCalledWith({
      userId: 'user_1',
      role: 'user',
      displayName: 'Jane',
      avatarUrl: null,
    })
    expect(result).toEqual({
      settings: { id: 'ws_123', slug: 'acme', name: 'Acme Inc' },
      user: { id: 'user_1', email: 'jane@acme.com', name: 'Jane', image: null },
      principal: { id: 'principal_mock123', role: 'user', type: 'user' },
      canPortalHandoff: true,
    })
  })

  it('presents a teammate at widget tier and blocks the portal handoff', async () => {
    // A teammate's Bearer (or a reused dashboard cookie) must not unlock team
    // actions through widget endpoints, and the widget must not mint them a
    // portal OTT.
    mockGet.mockReturnValue('Bearer valid-token-123')
    mockSessionFindFirst.mockResolvedValue({
      userId: 'user_1',
      user: { id: 'user_1', email: 'test@test.com', name: 'Test', image: null },
    })
    mockEnsurePrincipal.mockResolvedValue({
      principal: { id: 'principal_1', role: 'member', type: 'user' },
      created: false,
    })

    const result = await getWidgetSession()

    expect(result?.user.image).toBeNull()
    expect(result?.principal.role).toBe('user')
    expect(result?.principal.type).toBe('user')
    expect(result?.canPortalHandoff).toBe(false)
  })

  it('blocks the portal handoff for admins too', async () => {
    mockGet.mockReturnValue('Bearer valid-token-123')
    mockSessionFindFirst.mockResolvedValue({
      userId: 'user_1',
      user: { id: 'user_1', email: 'test@test.com', name: 'Test', image: null },
    })
    mockEnsurePrincipal.mockResolvedValue({
      principal: { id: 'principal_1', role: 'admin', type: 'user' },
      created: false,
    })

    const result = await getWidgetSession()

    expect(result?.principal.role).toBe('user')
    expect(result?.canPortalHandoff).toBe(false)
  })

  it('resolves an uploaded imageKey when user.image is null', async () => {
    mockGet.mockReturnValue('Bearer valid-token-123')
    mockSessionFindFirst.mockResolvedValue({
      userId: 'user_1',
      user: {
        id: 'user_1',
        email: 'test@test.com',
        name: 'Test',
        image: null,
        imageKey: 'avatars/me.png',
      },
    })
    mockEnsurePrincipal.mockResolvedValue({
      principal: { id: 'principal_1', role: 'user', type: 'user' },
      created: false,
    })

    const result = await getWidgetSession()

    expect(result?.user.image).toBe('https://cdn.example/avatars/me.png')
  })
})
