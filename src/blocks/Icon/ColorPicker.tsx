'use client'

import { FieldLabel, useField } from '@payloadcms/ui'
import type { TextFieldClientComponent } from 'payload'

import styles from './ColorPicker.module.css'

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/

export const ColorPicker: TextFieldClientComponent = ({ field, path, readOnly }) => {
  const { disabled, setValue, value } = useField<string>({ potentiallyStalePath: path })
  const isDisabled = disabled || readOnly
  const color = typeof value === 'string' ? value : '#000000'
  const pickerColor = HEX_COLOR_PATTERN.test(color) ? color : '#000000'

  return (
    <div className={`field-type ${styles.picker}`}>
      <FieldLabel label={field.label} path={path} required={field.required} />
      <div className={styles.controls}>
        <input
          aria-label="Choose icon colour"
          className={styles.swatch}
          disabled={isDisabled}
          onChange={(event) => setValue(event.target.value.toUpperCase())}
          type="color"
          value={pickerColor}
        />
        <input
          aria-label="Icon colour hex value"
          className={styles.value}
          disabled={isDisabled}
          onChange={(event) => setValue(event.target.value)}
          placeholder="#000000"
          type="text"
          value={color}
        />
      </div>
    </div>
  )
}
