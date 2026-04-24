import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Grid } from '@/components/Grid'
import { cn } from '@/utilities/cn'
import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
  description: string
  emptyMessage: string
  isEmpty: boolean
  title: string
}

export const LibraryPage = ({
  children,
  className,
  description,
  emptyMessage,
  isEmpty,
  title,
}: Props) => {
  return (
    <div className={cn('container py-10 md:py-16', className)}>
      <header className="max-w-2xl space-y-3">
        <p className="text-xs font-mono uppercase tracking-[0.24em] text-primary/55">
          Print Library
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="text-base text-muted-foreground">{description}</p>
      </header>

      {!isEmpty ? (
        <Grid className="mt-10 grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">{children}</Grid>
      ) : (
        <Card className="mt-10 border-dashed bg-background/70">
          <CardHeader>
            <CardTitle>Nothing published yet</CardTitle>
            <CardDescription>{emptyMessage}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Check back soon or start a quote and we&apos;ll help you choose the right option.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
