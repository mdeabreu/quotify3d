import type { CollectionConfig } from 'payload'

import { randomUUID } from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'

import { adminOrCustomerOwner } from '@/access/adminOrCustomerOwner'
import { publicAccess } from '@/access/publicAccess'
import { normalizeCustomerOrEmail } from '@/hooks/normalizeCustomerOrEmail'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export const Models: CollectionConfig = {
  slug: 'models',
  labels: {
    plural: 'Models',
    singular: 'Model',
  },
  access: {
    create: publicAccess,
    delete: adminOrCustomerOwner,
    read: adminOrCustomerOwner,
    update: adminOrCustomerOwner,
  },
  admin: {
    defaultColumns: ['originalFilename', 'filename', 'customer', 'customerEmail'],
    group: 'Jobs',
    useAsTitle: 'originalFilename',
  },
  fields: [
    {
      name: 'originalFilename',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'customerEmail',
      type: 'email',
      admin: {
        description: 'Used when the requester is not logged in.',
        position: 'sidebar',
      },
    },
  ],
  hooks: {
    beforeOperation: [
      ({ args, operation, req }) => {
        if ((operation === 'create' || operation === 'update') && req.file) {
          args.data ||= {}

          args.data.originalFilename = req.file.name

          const parsed = path.parse(req.file.name)
          const safeBase = parsed.name
            .replace(/[^a-z0-9]+/gi, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase()
          const uniqueSuffix = randomUUID()
          const base = safeBase || 'model'
          const extension = parsed.ext || '.stl'
          const uniqueFilename = `${base}-${uniqueSuffix}${extension}`

          req.file.name = uniqueFilename
        }
      },
    ],
    beforeChange: [normalizeCustomerOrEmail],
  },
  upload: {
    staticDir: path.resolve(dirname, '../../data/models'),
  },
}
