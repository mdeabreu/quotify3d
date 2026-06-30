import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ColourOptionPreview, ColourPreview } from '@/components/ColourPreview'

describe('ColourPreview', () => {
  it('renders an accessible generated colour preview from swatches', () => {
    render(
      <ColourPreview
        finish="silk"
        name="Sunset Shift"
        swatches={['#ff6600', '#3300ff']}
        type="co-extrusion"
      />,
    )

    expect(screen.getByLabelText('Sunset Shift colour preview')).toBeTruthy()
  })

  it('does not render without swatches', () => {
    const { container } = render(
      <ColourOptionPreview
        option={{
          finish: 'regular',
          name: 'Missing Swatch',
          swatches: [],
          type: 'solid',
        }}
      />,
    )

    expect(container.firstChild).toBeNull()
  })
})
