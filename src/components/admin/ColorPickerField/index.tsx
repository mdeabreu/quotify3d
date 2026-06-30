'use client'

import { FieldLabel, useField } from '@payloadcms/ui'
import type { TextFieldClientComponent } from 'payload'
import { useState } from 'react'

import styles from './styles.module.css'

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/
const SHORT_HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{3}$/

export const normalizeHexColorValue = (value: string): string => {
  const trimmed = value.trim()

  if (SHORT_HEX_COLOR_PATTERN.test(trimmed)) {
    const [, red, green, blue] = trimmed
    return `#${red}${red}${green}${green}${blue}${blue}`.toUpperCase()
  }

  if (HEX_COLOR_PATTERN.test(trimmed)) {
    return trimmed.toUpperCase()
  }

  return value
}

export const ColorPickerField: TextFieldClientComponent = ({ field, path, readOnly }) => {
  const { disabled, setValue, value } = useField<string>({ potentiallyStalePath: path })
  const isDisabled = disabled || readOnly
  const color = typeof value === 'string' ? value : '#000000'
  const [draft, setDraft] = useState({ source: color, value: color })
  const draftColor = draft.source === color ? draft.value : color
  const normalizedDraftColor = normalizeHexColorValue(draftColor)
  const normalizedFieldColor = normalizeHexColorValue(color)
  const pickerColor = HEX_COLOR_PATTERN.test(normalizedDraftColor)
    ? normalizedDraftColor
    : HEX_COLOR_PATTERN.test(normalizedFieldColor)
      ? normalizedFieldColor
      : '#000000'

  return (
    <div className={`field-type ${styles.picker}`}>
      <FieldLabel label={field.label} path={path} required={field.required} />
      <div className={styles.controls}>
        <input
          aria-label="Choose colour"
          className={styles.swatch}
          disabled={isDisabled}
          onChange={(event) => {
            const normalizedValue = normalizeHexColorValue(event.target.value)
            setDraft({ source: normalizedValue, value: normalizedValue })
            setValue(normalizedValue)
          }}
          type="color"
          value={pickerColor}
        />
        <input
          aria-label="Colour hex value"
          className={styles.value}
          disabled={isDisabled}
          onBlur={() => {
            const normalizedValue = normalizeHexColorValue(draftColor)
            setDraft({ source: normalizedValue, value: normalizedValue })
            setValue(normalizedValue)
          }}
          onChange={(event) => setDraft({ source: color, value: event.target.value })}
          placeholder="#000000"
          type="text"
          value={draftColor}
        />
      </div>
    </div>
  )
}
