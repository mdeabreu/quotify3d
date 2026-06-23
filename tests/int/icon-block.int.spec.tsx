import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { IconBlock } from '@/blocks/Icon/Component'
import { getLucideIcon, lucideIconNames } from '@/blocks/Icon/icons'

describe('Icon block', () => {
  it('exposes the installed canonical Lucide icon catalogue', () => {
    expect(lucideIconNames).toContain('Bolt')
    expect(lucideIconNames).toContain('Search')
    expect(lucideIconNames).not.toContain('SearchIcon')
    expect(getLucideIcon('Bolt')).toBeDefined()
  })

  it('renders configured colour, custom size, and an accessible label', () => {
    const markup = renderToStaticMarkup(
      <IconBlock
        blockType="icon"
        color="#12AB34"
        customSize={37}
        icon="Bolt"
        label="Fast charging"
        size="custom"
      />,
    )

    expect(markup).toContain('stroke="#12AB34"')
    expect(markup).toContain('width="37"')
    expect(markup).toContain('aria-label="Fast charging"')
    expect(markup).toContain('role="img"')
  })

  it('hides an unlabelled icon from assistive technology and ignores unknown icons', () => {
    const decorativeMarkup = renderToStaticMarkup(
      <IconBlock blockType="icon" color="#000000" icon="Bolt" size="24" />,
    )
    const unknownMarkup = renderToStaticMarkup(
      <IconBlock blockType="icon" color="#000000" icon="NoLongerAnIcon" size="24" />,
    )

    expect(decorativeMarkup).toContain('aria-hidden="true"')
    expect(unknownMarkup).toBe('')
  })
})
