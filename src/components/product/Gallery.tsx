'use client'

import type { Media as MediaType, Product } from '@/payload-types'

import { Media } from '@/components/Media'
import { GridTileImage } from '@/components/Grid/tile'
import { useSearchParams } from 'next/navigation'
import React, { useEffect, useMemo } from 'react'

import { Carousel, CarouselApi, CarouselContent, CarouselItem } from '@/components/ui/carousel'
import { DefaultDocumentIDType } from 'payload'

type Props = {
  gallery: NonNullable<Product['gallery']>
}

export const Gallery: React.FC<Props> = ({ gallery }) => {
  const searchParams = useSearchParams()
  const [current, setCurrent] = React.useState(0)
  const [api, setApi] = React.useState<CarouselApi>()
  const selectedVariantIndex = useMemo(() => {
    const values = Array.from(searchParams.values())

    return gallery.findIndex((item) => {
      if (!item.variantOption) return false

      let variantID: DefaultDocumentIDType

      if (typeof item.variantOption === 'object') {
        variantID = item.variantOption.id
      } else variantID = item.variantOption

      return Boolean(values.find((value) => value === String(variantID)))
    })
  }, [gallery, searchParams])

  useEffect(() => {
    if (!api) {
      return
    }
  }, [api])

  useEffect(() => {
    if (api && selectedVariantIndex !== -1) {
      api.scrollTo(selectedVariantIndex, true)
    }
  }, [api, selectedVariantIndex])

  const currentIndex = selectedVariantIndex !== -1 ? selectedVariantIndex : current

  return (
    <div>
      <div className="relative w-full overflow-hidden mb-8">
        <Media
          resource={gallery[currentIndex].image}
          className="w-full"
          imgClassName="w-full rounded-lg"
        />
      </div>

      <Carousel setApi={setApi} className="w-full" opts={{ align: 'start', loop: false }}>
        <CarouselContent>
          {gallery.map((item, i) => {
            if (typeof item.image !== 'object') return null

            return (
            <CarouselItem
              className="basis-1/5"
              key={`${item.image.id}-${i}`}
              onClick={() => setCurrent(i)}
            >
              <GridTileImage active={i === currentIndex} media={item.image} />
            </CarouselItem>
          )
        })}
        </CarouselContent>
      </Carousel>
    </div>
  )
}
