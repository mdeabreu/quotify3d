import { Media } from '@/components/Media'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Media as MediaAsset } from '@/payload-types'
import type { ReactNode } from 'react'

type Props = {
  children?: ReactNode
  description: string | null
  image: MediaAsset | null
  title: string
}

export const LibraryCardFrame = ({ children, description, image, title }: Props) => {
  return (
    <Card className="h-full overflow-hidden py-0">
      <div className="border-b bg-muted/20">
        {image ? (
          <Media
            alt={title}
            className="relative aspect-[4/3] w-full"
            imgClassName="h-full w-full object-cover"
            priority={false}
            resource={image}
          />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-br from-muted/60 via-background to-muted/30 text-xs font-mono uppercase tracking-[0.24em] text-primary/45">
            No Preview
          </div>
        )}
      </div>

      <CardHeader className="gap-2">
        <CardTitle className="text-xl">{title}</CardTitle>
        {description ? <p className="text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </CardHeader>

      {children ? <CardContent className="mt-auto pb-6">{children}</CardContent> : null}
    </Card>
  )
}
