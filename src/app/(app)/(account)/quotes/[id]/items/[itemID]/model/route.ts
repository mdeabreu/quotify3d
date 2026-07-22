import { readFile } from 'fs/promises'
import path from 'path'

import { findAccessibleQuote } from '@/lib/quotes/findAccessibleQuote'
import { resolveRelationID } from '@/utilities/resolveRelationID'
import configPromise from '@payload-config'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string; itemID: string }> },
) => {
  const { id, itemID } = await params
  const url = new URL(request.url)
  const email = url.searchParams.get('email')?.trim().toLowerCase() ?? ''
  const accessToken = url.searchParams.get('accessToken')?.trim() ?? ''
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await getHeaders() })
  const quote = await findAccessibleQuote({
    accessToken,
    customerEmail: email,
    payload,
    quoteID: id,
    user,
  })

  if (!quote) return new Response('Not found', { status: 404 })

  const item = quote.items.find((candidate) => candidate.id === itemID)
  const modelID = resolveRelationID(item?.model)
  if (!modelID) return new Response('Not found', { status: 404 })

  const model = await payload.findByID({
    collection: 'models',
    id: modelID,
    depth: 0,
    overrideAccess: true,
  })
  if (!model.filename) return new Response('Not found', { status: 404 })

  try {
    const data = await readFile(path.join(process.cwd(), 'data', 'models', model.filename))
    const filename = model.originalFilename || model.filename
    return new Response(data, {
      headers: {
        'Cache-Control': 'private, max-age=300',
        'Content-Disposition': `inline; filename="${filename.replaceAll('"', '')}"`,
        'Content-Type': model.mimeType || 'application/octet-stream',
      },
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
