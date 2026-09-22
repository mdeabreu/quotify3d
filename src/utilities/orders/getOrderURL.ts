import { getServerSideURL } from '@/utilities/getURL'

export const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  return value.trim() || undefined
}

export const getOrderURL = ({
  accessToken,
  customerEmail,
  orderID,
  recipientSource,
}: {
  accessToken?: string
  customerEmail?: string
  orderID: number
  recipientSource: 'customer' | 'guest'
}) => {
  const serverURL = getServerSideURL()

  if (recipientSource === 'guest' && customerEmail && accessToken) {
    const queryParams = new URLSearchParams({ accessToken, email: customerEmail })
    return `${serverURL}/orders/${orderID}?${queryParams.toString()}`
  }

  return `${serverURL}/orders/${orderID}`
}
