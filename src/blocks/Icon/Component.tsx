import type { IconBlock as IconBlockProps } from '@/payload-types'
import { createElement } from 'react'

import { getLucideIcon } from './icons'

export const IconBlock: React.FC<IconBlockProps> = ({ color, customSize, icon, label, size }) => {
  const LucideIcon = getLucideIcon(icon)

  if (!LucideIcon) {
    return null
  }

  const configuredSize = size === 'custom' ? customSize : Number(size)
  const resolvedSize =
    typeof configuredSize === 'number' && Number.isFinite(configuredSize) ? configuredSize : 24
  const accessibleLabel = label?.trim()

  return (
    <div className="not-prose my-4">
      {createElement(LucideIcon, {
        'aria-hidden': accessibleLabel ? undefined : true,
        'aria-label': accessibleLabel,
        color,
        role: accessibleLabel ? 'img' : undefined,
        size: resolvedSize,
      })}
    </div>
  )
}
