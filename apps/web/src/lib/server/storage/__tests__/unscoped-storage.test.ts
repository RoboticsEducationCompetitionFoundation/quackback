/**
 * What a storage access with no workspace scope does.
 *
 * `currentWorkspaceNamespace()` answers `_` when nothing is scoped. Composed into a
 * shared bucket that is a real, shared prefix every unscoped caller in the fleet
 * would write into, and the background tier is where it bites — `exports/` is
 * written by a job with no request scope. So the namespace resolver never falls
 * back to a literal.
 *
 * The decision it makes instead has two halves, and both are asserted here:
 *
 * - **Self-hosted resolves.** One process, one database, one workspace: the
 *   namespace is that database's own `settings.id`.
 * - **Pooled refuses, and refuses because the database refused.** There is no
 *   unscoped database in a pooled process, so the read throws before a namespace
 *   exists. No storage-side guard, nothing for a later caller to forget.
 *
 * Each test re-imports the module graph, because the self-hosted answer is
 * memoised for the life of the process — as it must be, `settings.id` being a
 * primary key — and a test that inherited that memo from the test above it would
 * be asserting about the previous run rather than its own.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockConfig = {
  s3Bucket: 'self-hosted-bucket',
  s3Region: 'us-east-1',
  s3Endpoint: undefined as string | undefined,
  s3AccessKeyId: 'env-access-key',
  s3SecretAccessKey: 'env-secret-key',
  s3ForcePathStyle: true,
  s3PublicUrl: undefined as string | undefined,
  s3Proxy: false,
  azureStorageAccountName: undefined as string | undefined,
  azureStorageAccountKey: undefined as string | undefined,
  azureStorageBlobEndpoint: undefined as string | undefined,
  baseUrl: 'https://self-hosted.example.com',
}
vi.mock('@/lib/server/config', () => ({ config: mockConfig }))

/** Stands in for the `db` Proxy: answers for a self-hosted process, throws for a pooled one. */
const findFirst = vi.fn()
vi.mock('@/lib/server/db', () => ({
  db: {
    query: { settings: { findFirst: (...args: unknown[]) => findFirst(...args) } },
  },
}))

const sent: Array<{ Bucket: string; Key: string }> = []

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(function () {
    return {
      send: async (command: { input: { Bucket: string; Key: string } }) => {
        sent.push(command.input)
        return {}
      },
      destroy: vi.fn(),
    }
  }),
  PutObjectCommand: vi.fn(function (input: unknown) {
    return { input }
  }),
  GetObjectCommand: vi.fn(function (input: unknown) {
    return { input }
  }),
  DeleteObjectCommand: vi.fn(function (input: unknown) {
    return { input }
  }),
}))
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(async () => 'https://stub'),
}))

/** The self-hosted install's own workspace, as `settings.id` would report it. */
const LOCAL_WORKSPACE = 'workspace_01kzf9848he8h86ct48hanask6'
const KEY = 'exports/export_run_01h455vb4pex5vsknk084sn02q.zip'
const BYTES = Buffer.from([1, 2, 3])

/** A fresh module graph, so no memo survives from the test before. */
async function freshStorage() {
  vi.resetModules()
  return import('../s3')
}

beforeEach(() => {
  sent.length = 0
  findFirst.mockReset()
  mockConfig.azureStorageAccountName = undefined
  mockConfig.azureStorageAccountKey = undefined
  mockConfig.azureStorageBlobEndpoint = undefined
})

describe('a self-hosted process', () => {
  it('namespaces by its own settings.id', async () => {
    findFirst.mockResolvedValue({ id: LOCAL_WORKSPACE })
    const { uploadObject } = await freshStorage()

    await uploadObject(KEY, BYTES, 'application/zip')

    expect(sent).toHaveLength(1)
    expect(sent[0]!.Key).toBe(`w/${LOCAL_WORKSPACE}/${KEY}`)
    expect(sent[0]!.Bucket).toBe('self-hosted-bucket')
  })

  it('never composes the single-workspace literal', async () => {
    // `_` is the right answer for a cache key and the wrong one for a bucket.
    // In a shared bucket it is a prefix with no owner that every unscoped writer
    // in the fleet would land in.
    findFirst.mockResolvedValue({ id: LOCAL_WORKSPACE })
    const { uploadObject } = await freshStorage()

    await uploadObject(KEY, BYTES, 'application/zip')

    expect(sent[0]!.Key).not.toContain('/_/')
    expect(sent[0]!.Key.startsWith('w/_')).toBe(false)
  })

  it('reads settings.id once and reuses it', async () => {
    // settings.id is a primary key on a singleton row, so this is a
    // process-lifetime constant rather than a per-operation query.
    findFirst.mockResolvedValue({ id: LOCAL_WORKSPACE })
    const { uploadObject } = await freshStorage()

    await uploadObject(KEY, BYTES, 'application/zip')
    await uploadObject(KEY, BYTES, 'application/zip')

    expect(sent).toHaveLength(2)
    expect(findFirst).toHaveBeenCalledTimes(1)
  })

  it('refuses rather than guessing when the database has no settings row', async () => {
    findFirst.mockResolvedValue(undefined)
    const { uploadObject } = await freshStorage()
    const { WorkspaceNamespaceUnresolvable } = await import('../workspace-scope')

    await expect(uploadObject(KEY, BYTES, 'application/zip')).rejects.toThrow(
      WorkspaceNamespaceUnresolvable
    )
    expect(sent).toHaveLength(0)
  })
})

describe('a pooled process with no scope', () => {
  it('refuses, and the refusal is the database proxy s own', async () => {
    // Exactly what `db.ts` does under QUACKBACK_TENANCY=pooled: there is no
    // fleet-wide connection to fall back to, so the read throws. Storage adds no
    // check of its own — it inherits this one.
    const { WorkspaceScopeMissingError } = await import('@/lib/server/workspaces/workspace-context')
    findFirst.mockImplementation(() => {
      throw new WorkspaceScopeMissingError('A `db` call was made with no workspace resolved.')
    })
    const { uploadObject } = await freshStorage()

    await expect(uploadObject(KEY, BYTES, 'application/zip')).rejects.toThrow(
      WorkspaceScopeMissingError
    )
    expect(sent).toHaveLength(0)
  })

  it('refuses every command, not only the write path', async () => {
    const { WorkspaceScopeMissingError } = await import('@/lib/server/workspaces/workspace-context')
    findFirst.mockImplementation(() => {
      throw new WorkspaceScopeMissingError('A `db` call was made with no workspace resolved.')
    })
    const { deleteObject, getS3Object, generatePresignedGetUrl } = await freshStorage()

    await expect(getS3Object(KEY)).rejects.toThrow(WorkspaceScopeMissingError)
    await expect(deleteObject(KEY)).rejects.toThrow(WorkspaceScopeMissingError)
    await expect(generatePresignedGetUrl(KEY, 60)).rejects.toThrow(WorkspaceScopeMissingError)
    expect(sent).toHaveLength(0)
  })
})

describe('a self-hosted process on Azure Blob Storage', () => {
  const BLOB_PREFIX = `https://quackacct.blob.core.windows.net/self-hosted-bucket/w/${LOCAL_WORKSPACE}/`
  const requests: Array<{ url: URL; method: string; headers: Headers }> = []
  let respond: () => Response

  beforeEach(() => {
    mockConfig.azureStorageAccountName = 'quackacct'
    mockConfig.azureStorageAccountKey = Buffer.from('test-account-key').toString('base64')
    requests.length = 0
    respond = () => new Response(null, { status: 201 })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        requests.push({
          url: new URL(input),
          method: init?.method ?? 'GET',
          headers: new Headers(init?.headers),
        })
        return respond()
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('writes a block blob into the namespaced name with a write-only SAS', async () => {
    findFirst.mockResolvedValue({ id: LOCAL_WORKSPACE })
    const { uploadObject } = await freshStorage()

    await uploadObject(KEY, BYTES, 'application/zip')

    expect(sent).toHaveLength(0)
    expect(requests).toHaveLength(1)
    const req = requests[0]!
    expect(req.method).toBe('PUT')
    expect(`${req.url.origin}${req.url.pathname}`).toBe(`${BLOB_PREFIX}${KEY}`)
    expect(req.url.searchParams.get('sp')).toBe('cw')
    expect(req.url.searchParams.get('sr')).toBe('b')
    expect(req.url.searchParams.get('spr')).toBe('https')
    expect(req.url.searchParams.get('sig')).toBeTruthy()
    expect(req.headers.get('x-ms-blob-type')).toBe('BlockBlob')
    expect(req.headers.get('x-ms-blob-content-type')).toBe('application/zip')
  })

  it('reads the blob body and content type', async () => {
    findFirst.mockResolvedValue({ id: LOCAL_WORKSPACE })
    respond = () =>
      new Response('zip-bytes', { status: 200, headers: { 'content-type': 'application/zip' } })
    const { getS3Object } = await freshStorage()

    const got = await getS3Object(KEY)

    expect(await new Response(got.body).text()).toBe('zip-bytes')
    expect(got.contentType).toBe('application/zip')
    expect(requests[0]!.url.searchParams.get('sp')).toBe('r')
  })

  it('reports a missing blob as NotFound with a 404 status', async () => {
    findFirst.mockResolvedValue({ id: LOCAL_WORKSPACE })
    respond = () =>
      new Response(null, { status: 404, headers: { 'x-ms-error-code': 'BlobNotFound' } })
    const { getS3Object } = await freshStorage()

    await expect(getS3Object(KEY)).rejects.toMatchObject({
      name: 'NotFound',
      $metadata: { httpStatusCode: 404 },
    })
  })

  it('treats deleting a missing blob as success', async () => {
    findFirst.mockResolvedValue({ id: LOCAL_WORKSPACE })
    respond = () => new Response(null, { status: 404 })
    const { deleteObject } = await freshStorage()

    await expect(deleteObject(KEY)).resolves.toBeUndefined()
    expect(requests[0]!.method).toBe('DELETE')
    expect(requests[0]!.url.searchParams.get('sp')).toBe('d')
  })

  it('presigns a read-only GET with the download name, without a request', async () => {
    findFirst.mockResolvedValue({ id: LOCAL_WORKSPACE })
    const { generatePresignedGetUrl } = await freshStorage()

    const url = new URL(await generatePresignedGetUrl(KEY, 60, 'export.zip'))

    expect(requests).toHaveLength(0)
    expect(`${url.origin}${url.pathname}`).toBe(`${BLOB_PREFIX}${KEY}`)
    expect(url.searchParams.get('sp')).toBe('r')
    expect(url.searchParams.get('rscd')).toBe('attachment; filename="export.zip"')
  })

  it('uses a custom blob endpoint when set', async () => {
    findFirst.mockResolvedValue({ id: LOCAL_WORKSPACE })
    mockConfig.azureStorageBlobEndpoint = 'http://127.0.0.1:10000/quackacct/'
    const { generatePresignedGetUrl } = await freshStorage()

    const url = new URL(await generatePresignedGetUrl(KEY, 60))

    expect(`${url.origin}${url.pathname}`).toBe(
      `http://127.0.0.1:10000/quackacct/self-hosted-bucket/w/${LOCAL_WORKSPACE}/${KEY}`
    )
    expect(url.searchParams.get('spr')).toBeNull()
  })

  it('still refuses in a pooled process with no scope', async () => {
    const { WorkspaceScopeMissingError } = await import('@/lib/server/workspaces/workspace-context')
    findFirst.mockImplementation(() => {
      throw new WorkspaceScopeMissingError('A `db` call was made with no workspace resolved.')
    })
    const { uploadObject } = await freshStorage()

    await expect(uploadObject(KEY, BYTES, 'application/zip')).rejects.toThrow(
      WorkspaceScopeMissingError
    )
    expect(requests).toHaveLength(0)
  })
})
