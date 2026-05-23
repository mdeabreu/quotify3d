'use server'

import configPromise from '@payload-config'
import { render } from '@react-email/components'
import OrderAccessEmail from 'emails/order-access'
import { getPayload } from 'payload'

import { logSentEmail } from '@/utilities/email/logSentEmail'
import { getServerSideURL } from '@/utilities/getURL'

type SendOrderAccessEmailArgs = {
  email: string
  orderID: string
}

type SendOrderAccessEmailResult = {
  success: boolean
  error?: string
}

export async function sendOrderAccessEmail({
  email,
  orderID,
}: SendOrderAccessEmailArgs): Promise<SendOrderAccessEmailResult> {
  const payload = await getPayload({ config: configPromise })

  try {
    const { docs: orders } = await payload.find({
      collection: 'orders',
      where: {
        and: [{ id: { equals: orderID } }, { customerEmail: { equals: email } }],
      },
      limit: 1,
      depth: 0,
    })

    const order = orders[0]

    if (!order || !order.accessToken) {
      return { success: true }
    }

    const serverURL = getServerSideURL()
    const orderURL = `${serverURL}/orders/${order.id}?email=${encodeURIComponent(email)}&accessToken=${order.accessToken}`

    await payload.sendEmail({
      to: email,
      subject: `Access your order #${order.id}`,
      html: await render(OrderAccessEmail({ orderID: order.id, orderURL })),
    })

    logSentEmail({
      emailType: 'order-access',
      logger: payload.logger,
      orderID: order.id,
      to: email,
      url: orderURL,
    })

    return { success: true }
  } catch (err) {
    payload.logger.error({ msg: 'Failed to send order access email', err })
    return { success: true }
  }
}
