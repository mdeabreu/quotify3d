import { getCachedGlobal } from '@/utilities/getGlobals'

import './index.css'
import { HeaderClient } from './index.client'
import { resolveBranding } from '@/utilities/branding'

export async function Header() {
  const header = await getCachedGlobal('header', 1)()
  const siteSettings = await getCachedGlobal('siteSettings', 1)()
  const branding = resolveBranding(siteSettings)

  return <HeaderClient branding={branding} header={header} />
}
