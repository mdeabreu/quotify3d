import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ColorPickerField, normalizeHexColorValue } from '@/components/admin/ColorPickerField'
import { Icon } from '@/blocks/Icon/config'
import { Colours } from '@/collections/Colours'

const fieldState = vi.hoisted(() => ({
  disabled: false,
  setValue: vi.fn(),
  value: '#00aa11',
}))

vi.mock('@payloadcms/ui', async () => {
  const React = await import('react')

  return {
    FieldLabel: ({
      label,
      path,
      required,
    }: {
      label?: string | Record<string, string>
      path: string
      required?: boolean
    }) =>
      React.createElement(
        'label',
        {
          htmlFor: path,
        },
        `${typeof label === 'string' ? label : 'Colour'}${required ? ' *' : ''}`,
      ),
    useField: () => ({
      disabled: fieldState.disabled,
      setValue: fieldState.setValue,
      value: fieldState.value,
    }),
  }
})

afterEach(() => {
  cleanup()
})

const renderField = ({ readOnly = false } = {}) => {
  return render(
    <ColorPickerField
      field={{ label: 'Swatch', required: true } as never}
      path="swatches.0.hexcode"
      readOnly={readOnly}
    />,
  )
}

describe('ColorPickerField', () => {
  beforeEach(() => {
    fieldState.disabled = false
    fieldState.value = '#00aa11'
    fieldState.setValue.mockReset()
  })

  it('normalizes valid hex values', () => {
    expect(normalizeHexColorValue('#fa0')).toBe('#FFAA00')
    expect(normalizeHexColorValue('#12abef')).toBe('#12ABEF')
    expect(normalizeHexColorValue('#f')).toBe('#f')
  })

  it('renders the Payload field label and current value', () => {
    renderField()

    expect(screen.getByText('Swatch *')).toBeTruthy()
    expect((screen.getByLabelText('Colour hex value') as HTMLInputElement).value).toBe('#00aa11')
    expect((screen.getByLabelText('Choose colour') as HTMLInputElement).value).toBe('#00aa11')
  })

  it('updates from the native colour input as uppercase six-digit hex', () => {
    renderField()

    fireEvent.change(screen.getByLabelText('Choose colour'), {
      target: {
        value: '#12abef',
      },
    })

    expect(fieldState.setValue).toHaveBeenCalledWith('#12ABEF')
  })

  it('keeps text input drafts local until blur, then expands short hex values', () => {
    renderField()

    fireEvent.change(screen.getByLabelText('Colour hex value'), {
      target: {
        value: '#fa0',
      },
    })

    expect((screen.getByLabelText('Colour hex value') as HTMLInputElement).value).toBe('#fa0')
    expect(fieldState.setValue).not.toHaveBeenCalled()

    fireEvent.blur(screen.getByLabelText('Colour hex value'))

    expect(fieldState.setValue).toHaveBeenCalledWith('#FFAA00')
  })

  it('preserves invalid text input values on blur for Payload validation', () => {
    renderField()

    fireEvent.change(screen.getByLabelText('Colour hex value'), {
      target: {
        value: '#not-a-colour',
      },
    })
    fireEvent.blur(screen.getByLabelText('Colour hex value'))

    expect(fieldState.setValue).toHaveBeenCalledWith('#not-a-colour')
  })

  it('respects disabled and read-only states', () => {
    fieldState.disabled = true
    const { rerender } = renderField()

    expect((screen.getByLabelText('Choose colour') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByLabelText('Colour hex value') as HTMLInputElement).disabled).toBe(true)

    fieldState.disabled = false
    rerender(
      <ColorPickerField
        field={{ label: 'Swatch', required: true } as never}
        path="swatches.0.hexcode"
        readOnly
      />,
    )

    expect((screen.getByLabelText('Choose colour') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByLabelText('Colour hex value') as HTMLInputElement).disabled).toBe(true)
  })
})

describe('admin colour picker configuration', () => {
  it('uses the shared picker for Icon block colour fields', () => {
    const colorField = Icon.fields.find((field) => 'name' in field && field.name === 'color')

    expect(colorField).toMatchObject({
      admin: {
        components: {
          Field: '@/components/admin/ColorPickerField#ColorPickerField',
        },
      },
    })
  })

  it('uses the shared picker for Colour swatch hex fields', () => {
    const swatchesCollapsible = Colours.fields.find(
      (field) => 'label' in field && field.label === 'Swatches',
    )
    const swatchesField =
      swatchesCollapsible && 'fields' in swatchesCollapsible
        ? swatchesCollapsible.fields.find((field) => 'name' in field && field.name === 'swatches')
        : null
    const hexcodeField =
      swatchesField && 'fields' in swatchesField
        ? swatchesField.fields.find((field) => 'name' in field && field.name === 'hexcode')
        : null

    expect(hexcodeField).toMatchObject({
      admin: {
        components: {
          Field: '@/components/admin/ColorPickerField#ColorPickerField',
        },
      },
    })
  })
})
