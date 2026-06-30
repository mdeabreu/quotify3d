'use client'

import { ColourLibraryCard } from '@/components/library/LibraryCards'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Grid } from '@/components/Grid'
import type { ColourLibraryItem, ColourLibraryMaterial } from '@/lib/library'
import { cn } from '@/utilities/cn'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo } from 'react'

type Props = {
  colours: ColourLibraryItem[]
}

const MATERIAL_QUERY_PARAM = 'material'

const getMaterialOptions = (colours: ColourLibraryItem[]): ColourLibraryMaterial[] => {
  const materialBySlug = new Map<string, ColourLibraryMaterial>()

  for (const colour of colours) {
    for (const material of colour.materials) {
      if (!materialBySlug.has(material.slug)) {
        materialBySlug.set(material.slug, material)
      }
    }
  }

  return [...materialBySlug.values()].sort((left, right) => left.name.localeCompare(right.name))
}

export const ColourLibraryFilter = ({ colours }: Props) => {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const materialOptions = useMemo(() => getMaterialOptions(colours), [colours])
  const requestedMaterial = searchParams.get(MATERIAL_QUERY_PARAM)
  const selectedMaterial = materialOptions.some((material) => material.slug === requestedMaterial)
    ? requestedMaterial
    : null

  const filteredColours = selectedMaterial
    ? colours.filter((colour) =>
        colour.materials.some((material) => material.slug === selectedMaterial),
      )
    : colours

  const setSelectedMaterial = (slug: string | null) => {
    const nextParams = new URLSearchParams(searchParams.toString())

    if (slug) {
      nextParams.set(MATERIAL_QUERY_PARAM, slug)
    } else {
      nextParams.delete(MATERIAL_QUERY_PARAM)
    }

    const queryString = nextParams.toString()
    router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
  }

  return (
    <div className="mt-10 space-y-6">
      {materialOptions.length > 0 ? (
        <section aria-label="Filter colours by material" className="space-y-3">
          <p className="text-xs font-mono uppercase tracking-[0.24em] text-primary/55">
            Material
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              aria-pressed={!selectedMaterial}
              className={cn(
                'rounded-full border px-4 py-2 text-xs font-mono uppercase tracking-[0.18em] transition',
                !selectedMaterial
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-background text-primary/65 hover:border-primary/60 hover:text-primary',
              )}
              onClick={() => setSelectedMaterial(null)}
              type="button"
            >
              All
            </button>
            {materialOptions.map((material) => {
              const isSelected = material.slug === selectedMaterial

              return (
                <button
                  aria-pressed={isSelected}
                  className={cn(
                    'rounded-full border px-4 py-2 text-xs font-mono uppercase tracking-[0.18em] transition',
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'bg-background text-primary/65 hover:border-primary/60 hover:text-primary',
                  )}
                  key={material.id}
                  onClick={() => setSelectedMaterial(material.slug)}
                  type="button"
                >
                  {material.name}
                </button>
              )
            })}
          </div>
        </section>
      ) : null}

      {filteredColours.length > 0 ? (
        <Grid className="grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {filteredColours.map((item) => (
            <ColourLibraryCard item={item} key={item.id} />
          ))}
        </Grid>
      ) : (
        <Card className="border-dashed bg-background/70">
          <CardHeader>
            <CardTitle>No colours found</CardTitle>
            <CardDescription>
              No active colours are currently available for this material.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Choose another material or view all colours to compare the full library.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
