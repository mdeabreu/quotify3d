'use client'

import { Media } from '@/components/Media'
import { Message } from '@/components/Message'
import { Price } from '@/components/Price'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/providers/Auth'
import { useTheme } from '@/providers/Theme'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import * as qs from 'qs-esm'
import React, { Suspense, useEffect, useState } from 'react'

import { cssVariables } from '@/cssVariables'
import { CheckoutForm } from '@/components/forms/CheckoutForm'
import {
  useAddresses,
  useCart,
  useCurrency,
  usePayments,
} from '@payloadcms/plugin-ecommerce/client/react'
import { CheckoutAddresses } from '@/components/checkout/CheckoutAddresses'
import { CreateAddressModal } from '@/components/addresses/CreateAddressModal'
import { Address, Cart, Product, Variant } from '@/payload-types'
import { Checkbox } from '@/components/ui/checkbox'
import { AddressItem } from '@/components/addresses/AddressItem'
import { FormItem } from '@/components/forms/FormItem'
import { toast } from 'sonner'
import { LoadingSpinner } from '@/components/LoadingSpinner'

const apiKey = `${process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}`
const stripe = loadStripe(apiKey)
const normalizeCouponCode = (code: string): string => code.trim().toUpperCase()

type PaymentSummary = {
  currency: string
  lines: {
    amount: number
    label: string
    type: string
  }[]
  total: number
}

export const CheckoutPage: React.FC = () => {
  const { user } = useAuth()
  const router = useRouter()
  const { cart: providerCart } = useCart()
  const cart = providerCart as Cart | undefined
  const [error, setError] = useState<null | string>(null)
  const { theme } = useTheme()
  /**
   * State to manage the email input for guest checkout.
   */
  const [email, setEmail] = useState('')
  const [emailEditable, setEmailEditable] = useState(true)
  const [paymentData, setPaymentData] = useState<null | Record<string, unknown>>(null)
  const { initiatePayment } = usePayments()
  const { currency } = useCurrency()
  const { addresses } = useAddresses()
  const [shippingAddress, setShippingAddress] = useState<Partial<Address>>()
  const [billingAddress, setBillingAddress] = useState<Partial<Address>>()
  const [billingAddressSameAsShipping, setBillingAddressSameAsShipping] = useState(true)
  const [isProcessingPayment, setProcessingPayment] = useState(false)
  const [couponCode, setCouponCode] = useState('')
  const [couponError, setCouponError] = useState<null | string>(null)
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false)
  const [checkoutCart, setCheckoutCart] = useState<Cart>()

  const activeCart = checkoutCart?.id === cart?.id ? checkoutCart : cart
  const cartIsEmpty = !activeCart || !activeCart.items || !activeCart.items.length
  const appliedCoupon =
    typeof activeCart?.appliedCoupon === 'object' ? activeCart.appliedCoupon : undefined
  const displayCouponCode = appliedCoupon?.code || activeCart?.couponCode
  const couponTotal = typeof activeCart?.couponTotal === 'number' ? activeCart.couponTotal : null
  const couponDiscountAmount =
    typeof activeCart?.couponDiscountAmount === 'number'
      ? activeCart.couponDiscountAmount
      : 0
  const paymentSummary = paymentData?.summary as PaymentSummary | undefined
  const defaultBillingAddress = addresses?.[0]
  const effectiveBillingAddress = billingAddress ?? defaultBillingAddress
  const effectiveShippingAddress = billingAddressSameAsShipping
    ? effectiveBillingAddress
    : shippingAddress

  const canGoToPayment = Boolean(
    (email || user) && effectiveBillingAddress && effectiveShippingAddress,
  )

  useEffect(() => {
    return () => {
      setShippingAddress(undefined)
      setBillingAddress(undefined)
      setBillingAddressSameAsShipping(true)
      setEmail('')
      setEmailEditable(true)
    }
  }, [])

  const getCartSecret = () => {
    if (typeof window === 'undefined') return undefined
    return window.localStorage.getItem('cart_secret') || undefined
  }

  const getCartQuery = () => {
    const priceField = `priceIn${currency.code}`
    const secret = getCartSecret()
    return `?${qs.stringify({
      depth: 2,
      populate: {
        products: {
          [priceField]: true,
          gallery: true,
          inventory: true,
          slug: true,
          title: true,
        },
        variants: {
          [priceField]: true,
          inventory: true,
          options: true,
          title: true,
        },
      },
      ...(secret ? { secret } : {}),
      select: {
        appliedCoupon: true,
        couponCode: true,
        couponDiscountAmount: true,
        couponTotal: true,
        items: true,
        subtotal: true,
      },
    })}`
  }

  const updateCoupon = async (nextCouponCode: null | string, fallbackError: string) => {
    if (!activeCart?.id) {
      throw new Error(fallbackError)
    }

    const response = await fetch(`/api/carts/${activeCart.id}${getCartQuery()}`, {
      body: JSON.stringify({
        couponCode: nextCouponCode,
      }),
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'PATCH',
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data?.message || data?.errors?.[0]?.message || fallbackError)
    }

    setPaymentData(null)
    setCheckoutCart((data?.doc || data) as Cart)
  }

  const applyCoupon = async () => {
    const normalizedCouponCode = normalizeCouponCode(couponCode)
    if (!normalizedCouponCode) return

    setIsApplyingCoupon(true)
    setCouponError(null)

    try {
      await updateCoupon(normalizedCouponCode, 'Coupon could not be applied.')
      setCouponCode('')
      toast.success('Coupon applied.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Coupon could not be applied.'
      setCouponError(message)
      toast.error(message)
    } finally {
      setIsApplyingCoupon(false)
    }
  }

  const removeCoupon = async () => {
    setIsApplyingCoupon(true)
    setCouponError(null)

    try {
      await updateCoupon(null, 'Coupon could not be removed.')
      toast.success('Coupon removed.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Coupon could not be removed.'
      setCouponError(message)
      toast.error(message)
    } finally {
      setIsApplyingCoupon(false)
    }
  }

  const initiatePaymentIntent = async (paymentID: string) => {
    try {
      const paymentData = (await initiatePayment(paymentID, {
        additionalData: {
          ...(email ? { customerEmail: email } : {}),
          billingAddress: effectiveBillingAddress,
          shippingAddress: effectiveShippingAddress,
        },
      })) as Record<string, unknown>

      if (paymentData) {
        setPaymentData(paymentData)
      }
    } catch (error) {
      const errorData = error instanceof Error ? JSON.parse(error.message) : {}
      let errorMessage = 'An error occurred while initiating payment.'

      if (errorData?.cause?.code === 'OutOfStock') {
        errorMessage = 'One or more items in your cart are out of stock.'
      }

      setError(errorMessage)
      toast.error(errorMessage)
    }
  }

  if (!stripe) return null

  if (cartIsEmpty && isProcessingPayment) {
    return (
      <div className="py-12 w-full items-center justify-center">
        <div className="prose dark:prose-invert text-center max-w-none self-center mb-8">
          <p>Processing your payment...</p>
        </div>
        <LoadingSpinner />
      </div>
    )
  }

  if (cartIsEmpty) {
    return (
      <div className="prose dark:prose-invert py-12 w-full items-center">
        <p>Your cart is empty.</p>
        <Link href="/search">Continue shopping?</Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-stretch justify-stretch my-8 md:flex-row grow gap-10 md:gap-6 lg:gap-8">
      <div className="basis-full lg:basis-2/3 flex flex-col gap-8 justify-stretch">
        <h2 className="font-medium text-3xl">Contact</h2>
        {!user && (
          <div className=" bg-accent dark:bg-black rounded-lg p-4 w-full flex items-center">
            <div className="prose dark:prose-invert">
              <Button asChild className="no-underline text-inherit" variant="outline">
                <Link href="/login">Log in</Link>
              </Button>
              <p className="mt-0">
                <span className="mx-2">or</span>
                <Link href="/create-account">create an account</Link>
              </p>
            </div>
          </div>
        )}
        {user ? (
          <div className="bg-accent dark:bg-card rounded-lg p-4 ">
            <div>
              <p>{user.email}</p>{' '}
              <p>
                Not you?{' '}
                <Link className="underline" href="/logout">
                  Log out
                </Link>
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-accent dark:bg-black rounded-lg p-4 ">
            <div>
              <p className="mb-4">Enter your email to checkout as a guest.</p>

              <FormItem className="mb-6">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  disabled={!emailEditable}
                  id="email"
                  name="email"
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  type="email"
                />
              </FormItem>

              <Button
                disabled={!email || !emailEditable}
                onClick={(e) => {
                  e.preventDefault()
                  setEmailEditable(false)
                }}
                variant="default"
              >
                Continue as guest
              </Button>
            </div>
          </div>
        )}

        <h2 className="font-medium text-3xl">Address</h2>

        {effectiveBillingAddress ? (
          <div>
            <AddressItem
              actions={
                user ? (
                  <CheckoutAddresses
                    heading="Change billing address"
                    description="Choose a different billing address."
                    setAddress={setBillingAddress}
                  />
                ) : (
                  <Button
                    variant={'outline'}
                    disabled={Boolean(paymentData)}
                    onClick={(e) => {
                      e.preventDefault()
                      setBillingAddress(undefined)
                    }}
                  >
                    Remove
                  </Button>
                )
              }
              address={effectiveBillingAddress}
            />
          </div>
        ) : user ? (
          <CheckoutAddresses heading="Billing address" setAddress={setBillingAddress} />
        ) : (
          <CreateAddressModal
            disabled={!email || Boolean(emailEditable)}
            callback={(address) => {
              setBillingAddress(address)
            }}
            skipSubmission={true}
          />
        )}

        <div className="flex gap-4 items-center">
          <Checkbox
            id="shippingTheSameAsBilling"
            checked={billingAddressSameAsShipping}
            disabled={Boolean(paymentData || (!user && (!email || Boolean(emailEditable))))}
            onCheckedChange={(state) => {
              setBillingAddressSameAsShipping(state as boolean)
            }}
          />
          <Label htmlFor="shippingTheSameAsBilling">Shipping is the same as billing</Label>
        </div>

        {!billingAddressSameAsShipping && (
          <>
            {shippingAddress ? (
              <div>
                <AddressItem
                  actions={
                    <Button
                      variant={'outline'}
                      disabled={Boolean(paymentData)}
                      onClick={(e) => {
                        e.preventDefault()
                        setShippingAddress(undefined)
                      }}
                    >
                      Remove
                    </Button>
                  }
                  address={shippingAddress}
                />
              </div>
            ) : user ? (
              <CheckoutAddresses
                heading="Shipping address"
                description="Please select a shipping address."
                setAddress={setShippingAddress}
              />
            ) : (
              <CreateAddressModal
                callback={(address) => {
                  setShippingAddress(address)
                }}
                disabled={!email || Boolean(emailEditable)}
                skipSubmission={true}
              />
            )}
          </>
        )}

        {!paymentData && (
          <Button
            className="self-start"
            disabled={!canGoToPayment}
            onClick={(e) => {
              e.preventDefault()
              void initiatePaymentIntent('stripe')
            }}
          >
            Go to payment
          </Button>
        )}

        {!paymentData?.['clientSecret'] && error && (
          <div className="my-8">
            <Message error={error} />

            <Button
              onClick={(e) => {
                e.preventDefault()
                router.refresh()
              }}
              variant="default"
            >
              Try again
            </Button>
          </div>
        )}

        <Suspense fallback={<React.Fragment />}>
          {paymentData && Boolean(paymentData?.['clientSecret']) && (
            <div className="pb-16">
              <h2 className="font-medium text-3xl">Payment</h2>
              {error && <p>{`Error: ${error}`}</p>}
              <Elements
                options={{
                  appearance: {
                    theme: 'stripe',
                    variables: {
                      borderRadius: '6px',
                      colorPrimary: '#858585',
                      gridColumnSpacing: '20px',
                      gridRowSpacing: '20px',
                      colorBackground: theme === 'dark' ? '#0a0a0a' : cssVariables.colors.base0,
                      colorDanger: cssVariables.colors.error500,
                      colorDangerText: cssVariables.colors.error500,
                      colorIcon:
                        theme === 'dark' ? cssVariables.colors.base0 : cssVariables.colors.base1000,
                      colorText: theme === 'dark' ? '#858585' : cssVariables.colors.base1000,
                      colorTextPlaceholder: '#858585',
                      fontFamily: 'Geist, sans-serif',
                      fontSizeBase: '16px',
                      fontWeightBold: '600',
                      fontWeightNormal: '500',
                      spacingUnit: '4px',
                    },
                  },
                  clientSecret: paymentData['clientSecret'] as string,
                }}
                stripe={stripe}
              >
                <div className="flex flex-col gap-8">
                  <CheckoutForm
                    customerEmail={email}
                    billingAddress={effectiveBillingAddress}
                    setProcessingPayment={setProcessingPayment}
                  />
                  <Button
                    variant="ghost"
                    className="self-start"
                    onClick={() => setPaymentData(null)}
                  >
                    Cancel payment
                  </Button>
                </div>
              </Elements>
            </div>
          )}
        </Suspense>
      </div>

      {!cartIsEmpty && (
        <div className="basis-full lg:basis-1/3 lg:pl-8 p-8 border-none bg-primary/5 flex flex-col gap-8 rounded-lg">
          <h2 className="text-3xl font-medium">Your cart</h2>
          {activeCart?.items?.map((item, index) => {
            if (typeof item.product === 'object' && item.product) {
              const product = item.product as Product
              const { meta, title, gallery } = product
              const quantity = item.quantity
              const variant =
                item.variant && typeof item.variant === 'object'
                  ? (item.variant as Variant)
                  : undefined

              if (!quantity) return null

              let image = gallery?.[0]?.image || meta?.image
              const productPriceField = `priceIn${currency.code}` as keyof Product
              let price =
                typeof product[productPriceField] === 'number' ? product[productPriceField] : null

              const isVariant = Boolean(variant)

              if (isVariant) {
                const variantPriceField = `priceIn${currency.code}` as keyof Variant
                price =
                  typeof variant?.[variantPriceField] === 'number'
                    ? variant[variantPriceField]
                    : null

                const imageVariant = product.gallery?.find((item) => {
                  if (!item.variantOption) return false
                  const variantOptionID =
                    typeof item.variantOption === 'object'
                      ? item.variantOption.id
                      : item.variantOption

                  const hasMatch = variant?.options?.some((option) => {
                    if (typeof option === 'object') return option.id === variantOptionID
                    else return option === variantOptionID
                  })

                  return hasMatch
                })

                if (imageVariant && typeof imageVariant.image !== 'string') {
                  image = imageVariant.image
                }
              }

              return (
                <div className="flex items-start gap-4" key={index}>
                  <div className="flex items-stretch justify-stretch h-20 w-20 p-2 rounded-lg border">
                    <div className="relative w-full h-full">
                      {image && typeof image !== 'string' && (
                        <Media className="" fill imgClassName="rounded-lg" resource={image} />
                      )}
                    </div>
                  </div>
                  <div className="flex grow justify-between items-center">
                    <div className="flex flex-col gap-1">
                      <p className="font-medium text-lg">{title}</p>
                      {variant && (
                        <p className="text-sm font-mono text-primary/50 tracking-widest">
                          {variant.options
                            ?.map((option) => {
                              if (typeof option === 'object') return option.label
                              return null
                            })
                            .join(', ')}
                        </p>
                      )}
                      <div>
                        {'x'}
                        {quantity}
                      </div>
                    </div>

                    {typeof price === 'number' && <Price amount={price} />}
                  </div>
                </div>
              )
            }
            return null
          })}
          <hr />
          <div className="flex flex-col gap-3">
            <Label htmlFor="couponCode">Coupon</Label>
            {displayCouponCode ? (
              <div className="flex items-center justify-between gap-3 rounded-md border bg-background p-3">
                <span className="font-mono text-sm">{displayCouponCode}</span>
                <Button
                  disabled={Boolean(paymentData) || isApplyingCoupon}
                  onClick={(e) => {
                    e.preventDefault()
                    void removeCoupon()
                  }}
                  size="sm"
                  variant="outline"
                >
                  Remove
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  disabled={Boolean(paymentData) || isApplyingCoupon}
                  id="couponCode"
                  name="couponCode"
                  onChange={(e) => {
                    setCouponCode(e.target.value)
                    setCouponError(null)
                  }}
                  placeholder="Code"
                  value={couponCode}
                />
                <Button
                  disabled={!couponCode.trim() || Boolean(paymentData) || isApplyingCoupon}
                  onClick={(e) => {
                    e.preventDefault()
                    void applyCoupon()
                  }}
                  variant="outline"
                >
                  Apply
                </Button>
              </div>
            )}
            {couponError && <Message error={couponError} />}
          </div>
          <hr />
          {paymentSummary ? (
            <div className="flex flex-col gap-3">
              {paymentSummary.lines.map((line, index) => (
                <div
                  className="flex justify-between items-center gap-2"
                  key={`${line.type}-${index}`}
                >
                  <span>{line.label}</span>
                  <Price amount={line.amount} />
                </div>
              ))}
              <div className="flex justify-between items-center gap-2 pt-2 border-t">
                <span className="uppercase">Total</span>
                <Price className="text-3xl font-medium" amount={paymentSummary.total} />
              </div>
            </div>
          ) : (
            <>
              {displayCouponCode && couponDiscountAmount > 0 && couponTotal !== null && (
                <div className="flex justify-between items-center gap-2">
                  <span>Discount</span>
                  <Price amount={couponDiscountAmount * -1} />
                </div>
              )}
              <div className="flex justify-between items-center gap-2">
                <span className="uppercase">Total</span>
                {displayCouponCode && couponDiscountAmount > 0 && couponTotal !== null ? (
                  <div className="flex flex-col items-end gap-1">
                    <Price
                      className="text-sm line-through opacity-60"
                      amount={activeCart.subtotal || 0}
                    />
                    <Price className="text-3xl font-medium" amount={couponTotal} />
                  </div>
                ) : (
                  <Price className="text-3xl font-medium" amount={activeCart.subtotal || 0} />
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
