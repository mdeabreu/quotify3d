import type { Block } from 'payload'

import { lucideIconNames } from './icons'

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/

export const Icon: Block = {
  slug: 'icon',
  interfaceName: 'IconBlock',
  fields: [
    {
      name: 'icon',
      type: 'text',
      required: true,
      admin: {
        components: {
          Field: '@/blocks/Icon/IconPicker#IconPicker',
        },
      },
      validate: (value: unknown) => {
        if (typeof value !== 'string' || !value) {
          return 'Choose an icon.'
        }

        return lucideIconNames.includes(value) || 'Choose an icon from the Lucide catalogue.'
      },
    },
    {
      name: 'color',
      type: 'text',
      defaultValue: '#000000',
      required: true,
      admin: {
        components: {
          Field: '@/blocks/Icon/ColorPicker#ColorPicker',
        },
      },
      validate: (value: unknown) => {
        return typeof value === 'string' && HEX_COLOR_PATTERN.test(value)
          ? true
          : 'Use a six-digit hex colour, for example #000000.'
      },
    },
    {
      name: 'size',
      type: 'select',
      defaultValue: '24',
      options: [
        { label: '16 px', value: '16' },
        { label: '20 px', value: '20' },
        { label: '24 px', value: '24' },
        { label: '32 px', value: '32' },
        { label: '48 px', value: '48' },
        { label: '64 px', value: '64' },
        { label: 'Custom', value: 'custom' },
      ],
      required: true,
    },
    {
      name: 'customSize',
      type: 'number',
      admin: {
        condition: (_: unknown, siblingData: { size?: string }) => siblingData.size === 'custom',
      },
      max: 512,
      min: 1,
      validate: (value: unknown, { siblingData }: { siblingData?: { size?: string } }) => {
        if (siblingData?.size !== 'custom') {
          return true
        }

        return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 512
          ? true
          : 'Enter a whole number from 1 to 512.'
      },
    },
    {
      name: 'label',
      type: 'text',
      admin: {
        description: 'Optional. Leave blank when the icon is decorative.',
      },
    },
  ],
}
