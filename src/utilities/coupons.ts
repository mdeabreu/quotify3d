import type {
  AfterConfirmOrderHook,
  BeforeInitiatePaymentHook,
  Summary,
} from '@payloadcms/plugin-ecommerce/types'
import { APIError } from 'payload'
import type {
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  DefaultDocumentIDType,
  PayloadRequest,
} from 'payload'

import type { Cart, Coupon, Transaction } from '@/payload-types'

type RelationValue = DefaultDocumentIDType | { id?: DefaultDocumentIDType } | null | undefined
type CartItem = NonNullable<Cart['items']>[number]

type CouponResolution = {
  amount: number
  coupon: Coupon
  total: number
}

type CouponMetadata = {
  couponCode?: unknown
  couponID?: unknown
}

type DiscountLine = NonNullable<NonNullable<Transaction['summary']>['lines']>[number]

const couponError = (message: string) => new APIError(message, 400)

const getRelationID = (relation: RelationValue): DefaultDocumentIDType | undefined => {
  if (!relation) return undefined
  if (typeof relation === 'object') {
    return relation.id
  }
  return relation
}

export const normalizeCouponCode = (code: unknown): string =>
  typeof code === 'string' ? code.trim().toUpperCase() : ''

const getFixedDiscountField = (currency: string): keyof Coupon =>
  `discountAmountIn${currency.toUpperCase()}` as keyof Coupon

const getPriceField = (currency: string): string => `priceIn${currency.toUpperCase()}`

const getSummarySubtotal = (summary: Summary): number =>
  summary.lines.find((line) => line.type === 'subtotal')?.amount ?? summary.lines[0]?.amount ?? 0

const findCouponByCode = async ({
  code,
  req,
}: {
  code: string
  req: PayloadRequest
}): Promise<Coupon | null> => {
  const result = await req.payload.find({
    collection: 'coupons',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
    where: {
      code: {
        equals: code,
      },
    },
  })

  return result.docs[0] || null
}

export const resolveCouponCodeBeforeValidate: CollectionBeforeValidateHook = async ({
  data,
  req,
}) => {
  if (!data) return data

  if (!('couponCode' in data)) {
    if ('appliedCoupon' in data) {
      const nextData = { ...data }
      delete nextData.appliedCoupon
      return nextData
    }

    return data
  }

  const code = normalizeCouponCode(data.couponCode)

  if (!code) {
    return {
      ...data,
      appliedCoupon: null,
      couponCode: null,
    }
  }

  const coupon = await findCouponByCode({ code, req })

  if (!coupon) {
    throw couponError('Coupon does not exist.')
  }

  return {
    ...data,
    appliedCoupon: coupon.id,
    couponCode: code,
  }
}

const getItemAmount = async ({
  currency,
  item,
  req,
}: {
  currency: string
  item: CartItem
  req: PayloadRequest
}): Promise<number> => {
  const priceField = getPriceField(currency)
  const quantity = item.quantity || 1
  const variant = item.variant

  if (variant && typeof variant === 'object') {
    const price = (variant as unknown as Record<string, unknown>)[priceField]
    if (typeof price === 'number') return price * quantity
  }

  const variantID = getRelationID(variant)
  if (variantID) {
    const variantDoc = await req.payload.findByID({
      id: variantID,
      collection: 'variants',
      depth: 0,
      select: { [priceField]: true },
    })

    const price = (variantDoc as unknown as Record<string, unknown> | null)?.[priceField]
    return typeof price === 'number' ? price * quantity : 0
  }

  const product = item.product
  if (product && typeof product === 'object') {
    const price = (product as unknown as Record<string, unknown>)[priceField]
    if (typeof price === 'number') return price * quantity
  }

  const productID = getRelationID(product)
  if (!productID) return 0

  const productDoc = await req.payload.findByID({
    id: productID,
    collection: 'products',
    depth: 0,
    select: { [priceField]: true },
  })

  const price = (productDoc as unknown as Record<string, unknown> | null)?.[priceField]
  return typeof price === 'number' ? price * quantity : 0
}

const getEligibleProductSubtotal = async ({
  coupon,
  currency,
  items,
  req,
}: {
  coupon: Coupon
  currency: string
  items: CartItem[]
  req: PayloadRequest
}): Promise<number> => {
  const eligibleProductIDs = new Set(
    (coupon.eligibleProducts || []).map(getRelationID).filter(Boolean),
  )

  if (eligibleProductIDs.size === 0) return 0

  let subtotal = 0

  for (const item of items) {
    const productID = getRelationID(item.product)
    if (productID && eligibleProductIDs.has(productID)) {
      subtotal += await getItemAmount({ currency, item, req })
    }
  }

  return subtotal
}

const couponRedemptionsSlug = 'coupon-redemptions'

const getCouponRedemptionCount = async ({
  couponID,
  req,
}: {
  couponID: DefaultDocumentIDType
  req: PayloadRequest
}): Promise<number> => {
  const result = await req.payload.find({
    collection: couponRedemptionsSlug,
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
    where: {
      coupon: {
        equals: couponID,
      },
    },
  })

  return result.totalDocs
}

const getCouponMetadata = (metadata: DiscountLine['metadata']): CouponMetadata | null => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null

  return metadata as CouponMetadata
}

const getCouponDiscountLine = (summary: Transaction['summary']): DiscountLine | null =>
  summary?.lines?.find((line) => {
    if (line.type !== 'discount') return false

    const metadata = getCouponMetadata(line.metadata)
    return Boolean(metadata?.couponID)
  }) || null

const getDiscountAmount = ({
  coupon,
  discountBase,
  fixedAmount,
  subtotal,
}: {
  coupon: Coupon
  discountBase: number
  fixedAmount: number
  subtotal: number
}): { amount: number; total: number } => {
  const targetTotal =
    coupon.discountType === 'fixed'
      ? Math.max(0, Math.round(subtotal - Math.min(fixedAmount, discountBase)))
      : Math.max(0, Math.round(subtotal - discountBase * ((coupon.percentOff || 0) / 100)))

  return {
    amount: subtotal - targetTotal,
    total: targetTotal,
  }
}

export const resolveCouponForPayment = async ({
  cart,
  currency,
  enforceMaxRedemptions = true,
  req,
  summary,
}: {
  cart: Cart
  currency: string
  enforceMaxRedemptions?: boolean
  req: PayloadRequest
  summary: Summary
}): Promise<CouponResolution | null> => {
  const couponID = getRelationID(cart.appliedCoupon)

  if (!couponID) return null

  const coupon = await req.payload.findByID({
    id: couponID,
    collection: 'coupons',
    depth: 0,
    overrideAccess: true,
    req,
  })

  if (!coupon) {
    throw couponError('Coupon no longer exists.')
  }

  if (coupon.enabled === false) {
    throw couponError('Coupon is no longer active.')
  }

  const now = Date.now()
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now) {
    throw couponError('Coupon is not valid yet.')
  }

  if (coupon.endsAt && new Date(coupon.endsAt).getTime() < now) {
    throw couponError('Coupon has expired.')
  }

  const eligibleCustomers = coupon.eligibleCustomers || []
  if (eligibleCustomers.length > 0) {
    const userID = req.user?.id ? String(req.user.id) : undefined
    const isEligible = Boolean(
      userID && eligibleCustomers.some((customer) => String(getRelationID(customer)) === userID),
    )

    if (!isEligible) {
      throw couponError('This coupon is not available for this customer.')
    }
  }

  const subtotal = getSummarySubtotal(summary)

  if (coupon.minimumSubtotal && subtotal < coupon.minimumSubtotal) {
    throw couponError('Cart subtotal does not meet this coupon minimum.')
  }

  if (enforceMaxRedemptions && coupon.maxRedemptions) {
    const totalRedemptions = await getCouponRedemptionCount({
      couponID: coupon.id,
      req,
    })
    if (totalRedemptions >= coupon.maxRedemptions) {
      throw couponError('Coupon has reached its redemption limit.')
    }
  }

  const items = cart.items || []
  const discountBase =
    coupon.appliesTo === 'products'
      ? await getEligibleProductSubtotal({ coupon, currency, items, req })
      : subtotal

  if (discountBase <= 0) {
    throw couponError('Coupon is not valid for the products in this cart.')
  }

  const fixedAmount = coupon[getFixedDiscountField(currency)]
  const discount = getDiscountAmount({
    coupon,
    discountBase,
    fixedAmount: typeof fixedAmount === 'number' ? fixedAmount : 0,
    subtotal,
  })

  if (discount.amount <= 0) {
    throw couponError('Coupon does not provide a discount for this cart.')
  }

  return { amount: discount.amount, coupon, total: discount.total }
}

export const applyCouponPreviewBeforeChange: CollectionBeforeChangeHook = async ({ data, req }) => {
  if (!data) return data

  if (Array.isArray(data.items) && data.items.length === 0) {
    return {
      ...data,
      appliedCoupon: null,
      couponCode: null,
      couponDiscountAmount: 0,
      couponTotal: 0,
    }
  }

  const isUpdatingCouponCode = 'couponCode' in data
  const couponID = getRelationID(data.appliedCoupon)
  const subtotal = typeof data.subtotal === 'number' ? data.subtotal : 0

  if (!couponID || subtotal <= 0) {
    return {
      ...data,
      couponDiscountAmount: 0,
      couponTotal: subtotal,
    }
  }

  const currency = typeof data.currency === 'string' ? data.currency : 'CAD'

  try {
    const resolved = await resolveCouponForPayment({
      cart: data as Cart,
      currency,
      enforceMaxRedemptions: isUpdatingCouponCode,
      req,
      summary: {
        currency,
        lines: [{ amount: subtotal, label: 'Subtotal', type: 'subtotal' }],
        total: subtotal,
      },
    })

    return {
      ...data,
      couponDiscountAmount: resolved?.amount || 0,
      couponTotal: resolved?.total ?? subtotal,
    }
  } catch (error) {
    if (isUpdatingCouponCode) {
      throw error
    }

    return {
      ...data,
      appliedCoupon: null,
      couponCode: null,
      couponDiscountAmount: 0,
      couponTotal: subtotal,
    }
  }
}

export const applyCouponDiscount: BeforeInitiatePaymentHook = async ({
  cart,
  currency,
  req,
  summary,
}) => {
  const fullCart = (await req.payload.findByID({
    id: cart.id,
    collection: 'carts',
    depth: 2,
    overrideAccess: true,
    req,
  })) as Cart

  const resolved = await resolveCouponForPayment({
    cart: fullCart,
    currency,
    req,
    summary,
  })

  if (!resolved) return summary

  return {
    ...summary,
    lines: [
      ...summary.lines,
      {
        amount: resolved.amount * -1,
        label: `Coupon: ${resolved.coupon.code}`,
        metadata: {
          couponCode: resolved.coupon.code,
          couponID: resolved.coupon.id,
        },
        type: 'discount',
      },
    ],
  }
}

export const recordCouponRedemption: AfterConfirmOrderHook = async ({
  orderID,
  req,
  transactionID,
}) => {
  try {
    const transaction = (await req.payload.findByID({
      id: transactionID,
      collection: 'transactions',
      depth: 0,
      overrideAccess: true,
      req,
      select: {
        cart: true,
        currency: true,
        customer: true,
        customerEmail: true,
        summary: true,
      },
    })) as Transaction | null

    const discountLine = getCouponDiscountLine(transaction?.summary)
    const metadata = getCouponMetadata(discountLine?.metadata)
    const couponID = metadata?.couponID

    if (
      !transaction ||
      !discountLine ||
      !metadata ||
      (typeof couponID !== 'number' && typeof couponID !== 'string')
    ) {
      return
    }

    const couponRelationID = typeof couponID === 'number' ? couponID : Number(couponID)
    if (!Number.isFinite(couponRelationID)) return

    const existing = await req.payload.find({
      collection: couponRedemptionsSlug,
      depth: 0,
      limit: 1,
      overrideAccess: true,
      req,
      where: {
        transaction: {
          equals: transactionID,
        },
      },
    })

    if (existing.totalDocs > 0) return

    await req.payload.create({
      collection: couponRedemptionsSlug,
      data: {
        cart: getRelationID(transaction.cart),
        coupon: couponRelationID,
        couponCode:
          typeof metadata.couponCode === 'string'
            ? normalizeCouponCode(metadata.couponCode)
            : String(couponRelationID),
        currency: transaction.summary?.currency || transaction.currency || 'CAD',
        customer: getRelationID(transaction.customer),
        customerEmail: transaction.customerEmail,
        discountAmount: Math.abs(discountLine.amount),
        order: orderID,
        redeemedAt: new Date().toISOString(),
        transaction: transactionID,
      },
      overrideAccess: true,
      req,
    })
  } catch (error) {
    req.payload.logger.error({
      err: error,
      msg: 'Failed to record coupon redemption.',
      orderID,
      transactionID,
    })
  }
}
