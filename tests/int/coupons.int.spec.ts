import { APIError, type PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import {
  applyCouponPreviewBeforeChange,
  recordCouponRedemption,
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
      } as unknown as Parameters<typeof resolveCouponCodeBeforeValidate>[0])
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
    } as unknown as Parameters<typeof applyCouponPreviewBeforeChange>[0])

    expect(result).toMatchObject({
      appliedCoupon: null,
      couponCode: null,
      couponDiscountAmount: 0,
      couponTotal: 0,
      items: [],
    })
  })

  it('allows payment when the coupon has no completed redemptions', async () => {
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
        collection: 'coupon-redemptions',
        where: {
          coupon: {
            equals: 7,
          },
        },
      }),
    )
  })

  it('blocks payment when the coupon has reached max redemptions', async () => {
    const findByID = vi.fn().mockResolvedValue({
      appliesTo: 'cart',
      code: 'ONCE',
      discountAmountInCAD: 1000,
      discountType: 'fixed',
      enabled: true,
      id: 7,
      maxRedemptions: 1,
    })
    const find = vi.fn().mockResolvedValue({ totalDocs: 1 })
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
    ).rejects.toThrow('Coupon has reached its redemption limit.')
  })

  it('blocks applying a coupon when it has reached max redemptions', async () => {
    const findByID = vi.fn().mockResolvedValue({
      appliesTo: 'cart',
      code: 'ONCE',
      discountAmountInCAD: 1000,
      discountType: 'fixed',
      enabled: true,
      id: 7,
      maxRedemptions: 1,
    })
    const find = vi.fn().mockResolvedValue({ totalDocs: 1 })
    const req = {
      payload: {
        find,
        findByID,
      },
    } as unknown as PayloadRequest

    await expect(
      applyCouponPreviewBeforeChange({
        data: {
          appliedCoupon: 7,
          couponCode: 'ONCE',
          items: [{ product: 1, quantity: 1 }],
          subtotal: 5000,
        },
        req,
      } as unknown as Parameters<typeof applyCouponPreviewBeforeChange>[0]),
    ).rejects.toThrow('Coupon has reached its redemption limit.')

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'coupon-redemptions',
        where: {
          coupon: {
            equals: 7,
          },
        },
      }),
    )
  })

  it('does not enforce max redemptions while previewing cart coupon totals', async () => {
    const findByID = vi.fn().mockResolvedValue({
      appliesTo: 'cart',
      code: 'ONCE',
      discountAmountInCAD: 1000,
      discountType: 'fixed',
      enabled: true,
      id: 7,
      maxRedemptions: 1,
    })
    const find = vi.fn()
    const req = {
      payload: {
        find,
        findByID,
      },
    } as unknown as PayloadRequest

    const result = await applyCouponPreviewBeforeChange({
      data: {
        appliedCoupon: 7,
        items: [{ product: 1, quantity: 1 }],
        subtotal: 5000,
      },
      req,
    } as unknown as Parameters<typeof applyCouponPreviewBeforeChange>[0])

    expect(result).toMatchObject({
      couponDiscountAmount: 1000,
      couponTotal: 4000,
    })
    expect(find).not.toHaveBeenCalled()
  })

  it('records a coupon redemption once after successful order confirmation', async () => {
    const findByID = vi.fn().mockResolvedValue({
      cart: 44,
      currency: 'CAD',
      customer: 12,
      customerEmail: 'customer@example.com',
      summary: {
        currency: 'CAD',
        lines: [
          { amount: 5000, label: 'Subtotal', type: 'subtotal' },
          {
            amount: -1000,
            label: 'Coupon: ONCE',
            metadata: {
              couponCode: 'ONCE',
              couponID: 7,
            },
            type: 'discount',
          },
        ],
      },
    })
    const find = vi.fn().mockResolvedValue({ totalDocs: 0 })
    const create = vi.fn().mockResolvedValue({})
    const req = {
      payload: {
        create,
        find,
        findByID,
        logger: {
          error: vi.fn(),
        },
      },
    } as unknown as PayloadRequest

    await recordCouponRedemption({
      orderID: 99,
      req,
      transactionID: 123,
    })

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'coupon-redemptions',
        data: expect.objectContaining({
          cart: 44,
          coupon: 7,
          couponCode: 'ONCE',
          currency: 'CAD',
          customer: 12,
          customerEmail: 'customer@example.com',
          discountAmount: 1000,
          order: 99,
          transaction: 123,
        }),
      }),
    )
  })

  it('does not create duplicate redemptions for the same transaction', async () => {
    const findByID = vi.fn().mockResolvedValue({
      summary: {
        currency: 'CAD',
        lines: [
          {
            amount: -1000,
            label: 'Coupon: ONCE',
            metadata: {
              couponCode: 'ONCE',
              couponID: 7,
            },
            type: 'discount',
          },
        ],
      },
    })
    const find = vi.fn().mockResolvedValue({ totalDocs: 1 })
    const create = vi.fn()
    const req = {
      payload: {
        create,
        find,
        findByID,
        logger: {
          error: vi.fn(),
        },
      },
    } as unknown as PayloadRequest

    await recordCouponRedemption({
      orderID: 99,
      req,
      transactionID: 123,
    })

    expect(create).not.toHaveBeenCalled()
  })

  it('does not record a redemption without a coupon discount line', async () => {
    const findByID = vi.fn().mockResolvedValue({
      summary: {
        currency: 'CAD',
        lines: [{ amount: 5000, label: 'Subtotal', type: 'subtotal' }],
      },
    })
    const create = vi.fn()
    const req = {
      payload: {
        create,
        findByID,
        logger: {
          error: vi.fn(),
        },
      },
    } as unknown as PayloadRequest

    await recordCouponRedemption({
      orderID: 99,
      req,
      transactionID: 123,
    })

    expect(create).not.toHaveBeenCalled()
  })
})
