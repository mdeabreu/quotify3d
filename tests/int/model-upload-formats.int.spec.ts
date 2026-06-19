import { APIError } from 'payload'
import { describe, expect, it } from 'vitest'

import { Models } from '@/collections/Models'
import { getUnsupportedModelFilenames, isSupportedModelFilename } from '@/lib/modelUploadFormats'

const beforeOperation = Models.hooks?.beforeOperation?.[0]

if (!beforeOperation) {
  throw new Error('Models collection must define an upload validation hook.')
}

const runModelUploadHook = (filename: string) =>
  beforeOperation({
    args: {
      data: {},
    },
    operation: 'create',
    req: {
      file: {
        name: filename,
      },
    },
  } as never)

describe('model upload formats', () => {
  it('accepts supported extensions regardless of case', () => {
    expect(isSupportedModelFilename('bracket.STL')).toBe(true)
    expect(isSupportedModelFilename('assembly.3mf')).toBe(true)
    expect(isSupportedModelFilename('part.step')).toBe(true)
  })

  it('rejects unsupported extensions even when the MIME type is generic', () => {
    expect(
      getUnsupportedModelFilenames([{ name: 'invoice.pdf' }, { name: 'archive.zip' }]),
    ).toEqual(['invoice.pdf', 'archive.zip'])
  })

  it('enforces supported extensions in the Models collection', () => {
    expect(() => runModelUploadHook('invoice.pdf')).toThrow(APIError)
    expect(() => runModelUploadHook('part.STL')).not.toThrow()
  })
})
