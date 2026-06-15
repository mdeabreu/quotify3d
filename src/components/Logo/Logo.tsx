import React from 'react'

import { getDefaultBranding } from '@/utilities/branding'
import { LogoIcon } from '@/components/icons/logo'

export const Logo = () => {
  const { siteName } = getDefaultBranding()

  return (
    <span aria-label={`${siteName} logo`} className="inline-flex items-center text-black dark:text-white">
      <LogoIcon aria-hidden="true" className="h-6 w-6" />
      <span className="sr-only">{siteName}</span>
    </span>
  )
}
