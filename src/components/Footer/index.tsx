import type { Footer } from '@/payload-types'

import { FooterMenu } from '@/components/Footer/menu'
import { Media } from '@/components/Media'
import { ThemeSelector } from '@/providers/Theme/ThemeSelector'
import { resolveBranding } from '@/utilities/branding'
import { getCachedGlobal } from '@/utilities/getGlobals'
import Link from 'next/link'
import { Suspense } from 'react'

export async function Footer() {
  const footer: Footer = await getCachedGlobal('footer', 1)()
  const siteSettings = await getCachedGlobal('siteSettings', 1)()
  const branding = resolveBranding(siteSettings)
  const menu = footer.navItems || []
  const currentYear = new Date().getFullYear()
  const copyrightDate = 2026 + (currentYear > 2026 ? `-${currentYear}` : '')
  const skeleton = 'w-full h-6 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700'

  return (
    <footer className="text-sm text-neutral-500 dark:text-neutral-400">
      <div className="container">
        <div className="flex w-full flex-col gap-6 border-t border-neutral-200 py-12 text-sm md:flex-row md:gap-12 dark:border-neutral-700">
          <div>
            <Link
              aria-label={branding.siteName}
              className="flex items-center gap-2 text-black md:pt-1 dark:text-white"
              href="/"
            >
              {branding.logo ? (
                <Media
                  htmlElement={null}
                  imgClassName="h-6 w-auto object-contain"
                  resource={branding.logo}
                  size="96px"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={`${branding.siteName} logo`}
                  className="h-8 w-8 object-contain"
                  src="/images/quotify3d-site-logo.png"
                />
              )}
              <span className="sr-only">{branding.siteName}</span>
            </Link>
          </div>
          <Suspense
            fallback={
              <div className="flex h-[188px] w-[200px] flex-col gap-2">
                <div className={skeleton} />
                <div className={skeleton} />
                <div className={skeleton} />
                <div className={skeleton} />
                <div className={skeleton} />
                <div className={skeleton} />
              </div>
            }
          >
            <FooterMenu menu={menu} />
          </Suspense>
          <div className="md:ml-auto flex flex-col gap-4 items-end">
            <ThemeSelector />
          </div>
        </div>
      </div>
      <div className="border-t border-neutral-200 py-6 text-sm dark:border-neutral-700">
        <div className="container mx-auto flex w-full flex-col items-center gap-1 md:flex-row md:gap-0">
          <p>
            &copy; {copyrightDate} {branding.companyName}
            {branding.companyName.length && !branding.companyName.endsWith('.') ? '.' : ''} All
            rights reserved.
          </p>
          <hr className="mx-4 hidden h-4 w-px border-l border-neutral-400 md:inline-block" />
          <p>Made in Canada</p>
          <p className="flex flex-col text-center md:ml-auto md:text-right">
            <a
              className="text-black hover:underline dark:text-white"
              href="https://github.com/mdeabreu/quotify3d"
              rel="noreferrer"
              target="_blank"
            >
              Quotify3d
            </a>
            <a
              className="text-black hover:underline dark:text-white"
              href="https://payloadcms.com"
              rel="noreferrer"
              target="_blank"
            >
              Made with PayloadCMS
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
