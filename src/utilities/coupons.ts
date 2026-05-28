import type { BeforeInitiatePaymentHook, Summary } from '@payloadcms/plugin-ecommerce/types'
import type {
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  DefaultDocumentIDType,
  PayloadRequest,
} from 'payload'

import type { Cart, Coupon } from '@/payload-types'

type RelationValue = DefaultDocumentIDType | { id?: DefaultDocumentIDType } | null | undefined
type CartItem = NonNullable<Cart['items']>[number]

type CouponResolution = {
  amount: number
  coupon: Coupon
  total: number
}

const getRelationID = (relation: RelationValue): string | undefined => {
  if (!relation) return undefined
  if (typeof relation === 'object') {
    return relation.id ? String(relation.id) : undefined
  }
  return String(relation)
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
    throw new Error('Coupon does not exist.')
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

const getCouponPurchasedCartCount = async ({
  couponID,
  req,
}: {
  couponID: DefaultDocumentIDType
  req: PayloadRequest
}): Promise<number> => {
  const result = await req.payload.find({
    collection: 'carts',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
    where: {
      and: [{ appliedCoupon: { equals: couponID } }, { purchasedAt: { exists: true } }],
    },
  })

  return result.totalDocs
}

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
  req,
  summary,
}: {
  cart: Cart
  currency: string
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
    throw new Error('Coupon no longer exists.')
  }

  if (coupon.enabled === false) {
    throw new Error('Coupon is no longer active.')
  }

  const now = Date.now()
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now) {
    throw new Error('Coupon is not valid yet.')
  }

  if (coupon.endsAt && new Date(coupon.endsAt).getTime() < now) {
    throw new Error('Coupon has expired.')
  }

  const eligibleCustomers = coupon.eligibleCustomers || []
  if (eligibleCustomers.length > 0) {
    const userID = req.user?.id ? String(req.user.id) : undefined
    const isEligible = Boolean(
      userID && eligibleCustomers.some((customer) => getRelationID(customer) === userID),
    )

    if (!isEligible) {
      throw new Error('This coupon is not available for this customer.')
    }
  }

  const subtotal = getSummarySubtotal(summary)

  if (coupon.minimumSubtotal && subtotal < coupon.minimumSubtotal) {
    throw new Error('Cart subtotal does not meet this coupon minimum.')
  }

  if (coupon.maxRedemptions) {
    const totalRedemptions = await getCouponPurchasedCartCount({ couponID: coupon.id, req })
    if (totalRedemptions >= coupon.maxRedemptions) {
      throw new Error('Coupon has reached its redemption limit.')
    }
  }

  const items = cart.items || []
  const discountBase =
    coupon.appliesTo === 'products'
      ? await getEligibleProductSubtotal({ coupon, currency, items, req })
      : subtotal

  if (discountBase <= 0) {
    throw new Error('Coupon is not valid for the products in this cart.')
  }

  const fixedAmount = coupon[getFixedDiscountField(currency)]
  const discount = getDiscountAmount({
    coupon,
    discountBase,
    fixedAmount: typeof fixedAmount === 'number' ? fixedAmount : 0,
    subtotal,
  })

  if (discount.amount <= 0) {
    throw new Error('Coupon does not provide a discount for this cart.')
  }

  return { amount: discount.amount, coupon, total: discount.total }
}

export const applyCouponPreviewBeforeChange: CollectionBeforeChangeHook = async ({ data, req }) => {
  if (!data) return data

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
