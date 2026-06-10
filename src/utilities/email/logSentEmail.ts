import type { Payload } from 'payload'

type LogSentEmailArgs = {
  emailType: string
  gcodeID?: number | string
  logger: Payload['logger']
  orderID?: number | string
  quoteID?: number | string
  to: string
  url?: string
}

const shouldLogFullEmailURL = () =>
  process.env.NODE_ENV === 'development' || process.env.npm_lifecycle_event === 'dev'

export const getLoggedEmailURL = (url: string) => {
  if (shouldLogFullEmailURL()) return url

  try {
    const parsedURL = new URL(url)

    if (parsedURL.pathname.startsWith('/admin/reset/')) {
      parsedURL.pathname = '/admin/reset/[redacted]'
    }

    parsedURL.searchParams.forEach((_value, key) => {
      parsedURL.searchParams.set(key, '[redacted]')
    })

    return parsedURL.toString().replaceAll('%5Bredacted%5D', '[redacted]')
  } catch (_err) {
    return '[unparseable-url]'
  }
}

export const logSentEmail = ({
  emailType,
  gcodeID,
  logger,
  orderID,
  quoteID,
  to,
  url,
}: LogSentEmailArgs) => {
  logger.info({
    emailType,
    gcodeID,
    msg: 'Sent email',
    orderID,
    quoteID,
    to,
    url: url ? getLoggedEmailURL(url) : undefined,
  })
}
