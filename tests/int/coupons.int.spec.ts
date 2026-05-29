import { APIError, type PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import {
  applyCouponPreviewBeforeChange,
  resolveCouponCodeBeforeValidate,
  resolveCouponForPayment,
} from '@/utilities/coupons'

describe('coupon handling', () => {
  it('throws a public API error when a coupon code does not exist', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [] })
    const req = {
      payload: {
        find,
      },
    } as unknown as PayloadRequest

    let error: unknown

    try {
      await resolveCouponCodeBeforeValidate({
        data: {
          couponCode: ' missing ',
        },
        req,
      } as Parameters<typeof resolveCouponCodeBeforeValidate>[0])
    } catch (err) {
      error = err
    }

    expect(error).toBeInstanceOf(APIError)
    expect(error).toMatchObject({
      isPublic: true,
      message: 'Coupon does not exist.',
      status: 400,
    })
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          code: {
            equals: 'MISSING',
          },
        },
      }),
    )
  })

  it('clears coupon fields when the cart is emptied', async () => {
    const result = await applyCouponPreviewBeforeChange({
      data: {
        appliedCoupon: 1,
        couponCode: 'SAVE20',
        couponDiscountAmount: 2000,
        couponTotal: 8000,
        items: [],
        subtotal: 10000,
      },
      req: {} as PayloadRequest,
    } as Parameters<typeof applyCouponPreviewBeforeChange>[0])

    expect(result).toMatchObject({
      appliedCoupon: null,
      couponCode: null,
      couponDiscountAmount: 0,
      couponTotal: 0,
      items: [],
    })
  })

  it('does not count the cart being validated as a past redemption', async () => {
    const findByID = vi.fn().mockResolvedValue({
      appliesTo: 'cart',
      code: 'ONCE',
      discountAmountInCAD: 1000,
      discountType: 'fixed',
      enabled: true,
      id: 7,
      maxRedemptions: 1,
    })
    const find = vi.fn().mockResolvedValue({ totalDocs: 0 })
    const req = {
      payload: {
        find,
        findByID,
      },
    } as unknown as PayloadRequest

    await expect(
      resolveCouponForPayment({
        cart: {
          appliedCoupon: 7,
          id: 123,
          items: [{ product: 1, quantity: 1 }],
        } as Parameters<typeof resolveCouponForPayment>[0]['cart'],
        currency: 'CAD',
        req,
        summary: {
          currency: 'CAD',
          lines: [{ amount: 5000, label: 'Subtotal', type: 'subtotal' }],
          total: 5000,
        },
      }),
    ).resolves.toMatchObject({
      amount: 1000,
      total: 4000,
    })

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          and: [
            { appliedCoupon: { equals: 7 } },
            { purchasedAt: { exists: true } },
            { id: { not_equals: 123 } },
          ],
        },
      }),
    )
  })

  it('does not pass an undefined cart id into the redemption count query', async () => {
    const findByID = vi.fn().mockResolvedValue({
      appliesTo: 'cart',
      code: 'ONCE',
      discountAmountInCAD: 1000,
      discountType: 'fixed',
      enabled: true,
      id: 7,
      maxRedemptions: 1,
    })
    const find = vi.fn().mockResolvedValue({ totalDocs: 0 })
    const req = {
      payload: {
        find,
        findByID,
      },
    } as unknown as PayloadRequest

    await resolveCouponForPayment({
      cart: {
        appliedCoupon: 7,
        items: [{ product: 1, quantity: 1 }],
      } as Parameters<typeof resolveCouponForPayment>[0]['cart'],
      currency: 'CAD',
      req,
      summary: {
        currency: 'CAD',
        lines: [{ amount: 5000, label: 'Subtotal', type: 'subtotal' }],
        total: 5000,
      },
    })

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          and: [{ appliedCoupon: { equals: 7 } }, { purchasedAt: { exists: true } }],
        },
      }),
    )
  })
})
