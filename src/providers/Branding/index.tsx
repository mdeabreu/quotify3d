'use client'

import React, { createContext, useContext } from 'react'

import { DEFAULT_BRANDING } from '@/utilities/branding'

type BrandingContextValue = { quoteProductPlaceholder: string }

const BrandingContext = createContext<BrandingContextValue>({
  quoteProductPlaceholder: DEFAULT_BRANDING.quoteProductPlaceholder,
})

export const BrandingProvider = ({
  children,
  quoteProductPlaceholder,
}: BrandingContextValue & { children: React.ReactNode }) => (
  <BrandingContext.Provider value={{ quoteProductPlaceholder }}>{children}</BrandingContext.Provider>
)

export const useBranding = () => useContext(BrandingContext)
