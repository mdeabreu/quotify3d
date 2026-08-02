'use client'
import { CMSLink } from '@/components/Link'
import { Cart } from '@/components/Cart'
import { Media } from '@/components/Media'
import { OpenCartButton } from '@/components/Cart/OpenCart'
import Link from 'next/link'
import React, { Suspense } from 'react'

import { MobileMenu } from './MobileMenu'
import type { Header, Media as MediaType } from 'src/payload-types'

import { usePathname } from 'next/navigation'
import { cn } from '@/utilities/cn'

type Props = {
  branding: {
    logo: MediaType | null
    siteName: string
  }
  header: Header
}

export function HeaderClient({ branding, header }: Props) {
  const menu = header.navItems || []
  const pathname = usePathname()

  return (
    <div className="relative z-20 border-b">
      <nav className="container flex items-center justify-between pt-2 lg:items-end">
        <div className="block flex-none lg:hidden">
          <Suspense fallback={null}>
            <MobileMenu menu={menu} />
          </Suspense>
        </div>
        <div className="flex w-full items-end gap-6">
          <div className="flex min-w-0 flex-1 items-end gap-6">
            <Link
              aria-label={branding.siteName}
              className="flex w-full items-center justify-center pt-4 pb-4 lg:w-auto lg:shrink-0"
              href="/"
            >
              {branding.logo ? (
                <Media
                  htmlElement={null}
                  imgClassName="h-8 w-auto object-contain"
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
            </Link>
            {menu.length ? (
              <ul className="hidden items-center gap-4 whitespace-nowrap text-sm lg:flex">
                {menu.map((item) => (
                  <li key={item.id}>
                    <CMSLink
                      {...item.link}
                      size={'clear'}
                      className={cn('relative navLink', {
                        active:
                          item.link.url && item.link.url !== '/'
                            ? pathname.includes(item.link.url)
                            : false,
                      })}
                      appearance="nav"
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="ml-auto flex shrink-0 justify-end gap-4">
            <Suspense fallback={<OpenCartButton />}>
              <Cart />
            </Suspense>
          </div>
        </div>
      </nav>
    </div>
  )
}
