import { icons, type LucideIcon } from 'lucide-react'

export const lucideIconNames = Object.keys(icons).sort((left, right) => left.localeCompare(right))

export const getLucideIcon = (name: string): LucideIcon | undefined => {
  return icons[name as keyof typeof icons] as LucideIcon | undefined
}
