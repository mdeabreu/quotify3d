'use client'

import { FormError } from '@/components/forms/FormError'
import { FormItem } from '@/components/forms/FormItem'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/providers/Auth'
import React, { Fragment, useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import { sendQuoteAccessEmail } from './sendQuoteAccessEmail'

type FormData = {
  email: string
  quoteID: string
}

type Props = {
  initialEmail?: string
}

export const FindQuoteForm: React.FC<Props> = ({ initialEmail }) => {
  const { user } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<FormData>({
    defaultValues: {
      email: initialEmail || user?.email,
    },
  })

  const onSubmit = useCallback(
    async (data: FormData) => {
      setIsSubmitting(true)
      setSubmitError(null)

      try {
        const result = await sendQuoteAccessEmail({
          email: data.email,
          quoteID: data.quoteID,
        })

        if (result.success) {
          setSuccess(true)
        } else {
          setSubmitError(result.error || 'Something went wrong. Please try again.')
        }
      } catch {
        setSubmitError('Something went wrong. Please try again.')
      } finally {
        setIsSubmitting(false)
      }
    },
    [],
  )

  if (success) {
    return (
      <Fragment>
        <h1 className="mb-4 text-xl">Check your email</h1>
        <div className="prose dark:prose-invert">
          <p>
            {
              "If a quote exists with the provided email and quote ID, we've sent you an email with a link to view your quote details."
            }
          </p>
        </div>
      </Fragment>
    )
  }

  return (
    <Fragment>
      <h1 className="mb-4 text-xl">Find my quote</h1>
      <div className="prose mb-8 dark:prose-invert">
        <p>{`Please enter your email and quote ID below. We'll send you a link to view your quote.`}</p>
      </div>
      <form className="flex max-w-lg flex-col gap-8" onSubmit={handleSubmit(onSubmit)}>
        <FormItem>
          <Label className="mb-2" htmlFor="email">
            Email address
          </Label>
          <Input
            id="email"
            {...register('email', { required: 'Email is required.' })}
            type="email"
          />
          {errors.email && <FormError message={errors.email.message} />}
        </FormItem>
        <FormItem>
          <Label className="mb-2" htmlFor="quoteID">
            Quote ID
          </Label>
          <Input
            id="quoteID"
            {...register('quoteID', {
              required: 'Quote ID is required. You can find this in your email.',
            })}
            type="text"
          />
          {errors.quoteID && <FormError message={errors.quoteID.message} />}
        </FormItem>
        {submitError && <FormError message={submitError} />}
        <Button
          className="self-start"
          disabled={isSubmitting}
          type="submit"
          variant="default"
        >
          {isSubmitting ? 'Sending...' : 'Find quote'}
        </Button>
      </form>
    </Fragment>
  )
}
