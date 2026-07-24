import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PlateNavigator } from '@/components/ModelPreviewer/PlateNavigator'
import type { PreviewPlate } from '@/components/ModelPreviewer/archive'

const plates: PreviewPlate[] = [
  { id: '1', name: 'White', objectIds: new Set(['1']) },
  { id: '2', name: 'Shiny Red', objectIds: new Set(['2']) },
  { id: '3', name: 'Shiny Silver Green', objectIds: new Set(['3']) },
]

afterEach(cleanup)

describe('PlateNavigator', () => {
  it('shows the active position and stops sequential navigation at the ends', () => {
    const onSelect = vi.fn()
    const { rerender } = render(
      <PlateNavigator activeIndex={0} onReset={vi.fn()} onSelect={onSelect} plates={plates} />,
    )

    expect(screen.getByLabelText('Select preview plate. Plate 1 of 3: White')).toBeTruthy()
    expect(screen.getByLabelText('Previous plate')).toHaveProperty('disabled', true)
    fireEvent.click(screen.getByLabelText('Next plate'))
    expect(onSelect).toHaveBeenCalledWith(1)

    rerender(
      <PlateNavigator activeIndex={2} onReset={vi.fn()} onSelect={onSelect} plates={plates} />,
    )

    expect(
      screen.getByLabelText('Select preview plate. Plate 3 of 3: Shiny Silver Green'),
    ).toBeTruthy()
    expect(screen.getByLabelText('Next plate')).toHaveProperty('disabled', true)
    fireEvent.click(screen.getByLabelText('Previous plate'))
    expect(onSelect).toHaveBeenLastCalledWith(1)
  })

  it('keeps the full active name in the selector accessible label', () => {
    render(<PlateNavigator activeIndex={2} onReset={vi.fn()} onSelect={vi.fn()} plates={plates} />)

    const selector = screen.getByLabelText('Select preview plate. Plate 3 of 3: Shiny Silver Green')
    expect(selector.querySelector('[data-slot="select-value"]')).toBeTruthy()
  })

  it('retains Reset without showing plate controls for a single plate', () => {
    const onReset = vi.fn()
    render(
      <PlateNavigator activeIndex={0} onReset={onReset} onSelect={vi.fn()} plates={[plates[0]]} />,
    )

    expect(screen.queryByLabelText('Select preview plate')).toBeNull()
    expect(screen.queryByLabelText('Previous plate')).toBeNull()
    fireEvent.click(screen.getByLabelText('Reset view'))
    expect(onReset).toHaveBeenCalledOnce()
  })
})
