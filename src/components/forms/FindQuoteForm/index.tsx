'use client'

import { FormError } from '@/components/forms/FormError'
import { FormItem } from '@/components/forms/FormItem'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/providers/Auth'
import { useRouter } from 'next/navigation'
import React, { Fragment, useCallback } from 'react'
import { useForm } from 'react-hook-form'

type FormData = {
  email: string
  quoteID: string
}

type Props = {
  initialEmail?: string
}

export const FindQuoteForm: React.FC<Props> = ({ initialEmail }) => {
  const router = useRouter()
  const { user } = useAuth()

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
      router.push(`/quotes/${data.quoteID}?email=${data.email}`)
    },
    [router],
  )

  return (
    <Fragment>
      <h1 className="mb-4 text-xl">Find my quote</h1>
      <div className="prose mb-8 dark:prose-invert">
        <p>{`Please enter your email and quote ID below.`}</p>
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
        <Button className="self-start" type="submit" variant="default">
          Find my quote
        </Button>
      </form>
    </Fragment>
  )
}
