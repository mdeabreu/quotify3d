'use client'

import { FieldLabel, useField } from '@payloadcms/ui'
import { icons, type LucideIcon } from 'lucide-react'
import type { TextFieldClientComponent } from 'payload'
import { useMemo, useState } from 'react'

import { lucideIconNames } from './icons'
import styles from './IconPicker.module.css'

export const IconPicker: TextFieldClientComponent = ({ field, path, readOnly }) => {
  const { disabled, setValue, value } = useField<string>({ potentiallyStalePath: path })
  const [query, setQuery] = useState('')
  const isDisabled = disabled || readOnly
  const selectedIcon = typeof value === 'string' ? value : ''

  const filteredIcons = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return lucideIconNames
    }

    return lucideIconNames.filter((name) => name.toLowerCase().includes(normalizedQuery))
  }, [query])

  const SelectedIcon = icons[selectedIcon as keyof typeof icons] as LucideIcon | undefined

  return (
    <div className={`field-type ${styles.picker}`}>
      <FieldLabel label={field.label} path={path} required={field.required} />

      {SelectedIcon && (
        <div className={styles.selection} aria-live="polite">
          <SelectedIcon aria-hidden="true" size={24} />
          <span>{selectedIcon}</span>
        </div>
      )}

      <input
        aria-label="Filter Lucide icons"
        className={styles.search}
        disabled={isDisabled}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search icons..."
        type="search"
        value={query}
      />

      <div className={styles.results} aria-label="Lucide icon results" role="listbox">
        {filteredIcons.map((name) => {
          const Icon = icons[name as keyof typeof icons] as LucideIcon
          const isSelected = name === selectedIcon

          return (
            <button
              aria-label={name}
              aria-selected={isSelected}
              className={styles.option}
              disabled={isDisabled}
              key={name}
              onClick={() => setValue(name)}
              role="option"
              type="button"
            >
              <Icon aria-hidden="true" size={22} />
              <span>{name}</span>
            </button>
          )
        })}
      </div>

      {filteredIcons.length === 0 && <p className={styles.empty}>No icons found.</p>}
    </div>
  )
}
