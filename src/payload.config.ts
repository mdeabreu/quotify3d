import { sqliteAdapter } from '@payloadcms/db-sqlite'
import {
  BoldFeature,
  EXPERIMENTAL_TableFeature,
  IndentFeature,
  ItalicFeature,
  lexicalEditor,
  LinkFeature,
  LinkFields,
  OrderedListFeature,
  UnderlineFeature,
  UnorderedListFeature,
} from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig, TextFieldSingleValidation } from 'payload'
import { fileURLToPath } from 'url'

import { Categories } from '@/collections/Categories'
import { Colours } from '@/collections/Colours'
import { CouponRedemptions } from '@/collections/CouponRedemptions'
import { Coupons } from '@/collections/Coupons'
import { FilamentConfigs } from '@/collections/FilamentConfigs'
import { Filaments } from '@/collections/Filaments'
import { Gcodes } from '@/collections/Gcodes'
import { MachineConfigs } from '@/collections/MachineConfigs'
import { Machines } from '@/collections/Machines'
import { Media } from '@/collections/Media'
import { Models } from '@/collections/Models'
import { Pages } from '@/collections/Pages'
import { ProcessConfigs } from '@/collections/ProcessConfigs'
import { Processes } from '@/collections/Processes'
import { Quotes } from '@/collections/Quotes'
import { Spools } from '@/collections/Spools'
import { Users } from '@/collections/Users'
import { Vendors } from '@/collections/Vendors'
import { Footer } from '@/globals/Footer'
import { Header } from '@/globals/Header'
import { SiteSettings } from '@/globals/SiteSettings'
import { buildSlicerContextTask } from '@/jobs/tasks/buildSlicerContextTask'
import { extractSlicerMetricsTask } from '@/jobs/tasks/extractSlicerMetricsTask'
import { sliceModelTask } from '@/jobs/tasks/sliceModelTask'
import { sliceGcodeWorkflow } from '@/jobs/workflows/sliceGcode'
import { migrations } from '@/migrations'
import { plugins } from './plugins'

import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import sharp from 'sharp'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const configCollections = [ProcessConfigs, MachineConfigs, FilamentConfigs]
const catalogCollections = [Colours, Filaments, Machines, Processes]
const productionCollections = [Models, Quotes, Gcodes]
const operationsCollections = [Spools, Vendors]

const isNextBuild = process.env.NEXT_PHASE === 'phase-production-build'
const shouldRunProdMigrations =
  process.env.NODE_ENV === 'production' &&
  (!isNextBuild || process.env.PAYLOAD_MIGRATE_DURING_BUILD === 'true')

const requiredSMTPEnv = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'] as const

const getEnv = (key: string) => process.env[key]?.trim()

const parseBooleanEnv = (key: string) => {
  const value = getEnv(key)?.toLowerCase()

  if (!value) {
    return false
  }

  if (value === 'true') {
    return true
  }

  if (value === 'false') {
    return false
  }

  throw new Error(`${key} must be either "true" or "false" when provided.`)
}

const parseSMTPSecure = () => {
  return getEnv('SMTP_SECURE') ? parseBooleanEnv('SMTP_SECURE') : undefined
}

const getEmailAdapter = () => {
  const smtpEnv = Object.fromEntries(requiredSMTPEnv.map((key) => [key, getEnv(key)])) as Record<
    (typeof requiredSMTPEnv)[number],
    string | undefined
  >
  const hasSMTPConfig = Object.values(smtpEnv).some(Boolean)

  if (!hasSMTPConfig) {
    return parseBooleanEnv('ENABLE_MOCK_EMAIL') ? nodemailerAdapter() : undefined
  }

  const missingEnv = requiredSMTPEnv.filter((key) => !smtpEnv[key])

  if (missingEnv.length > 0) {
    throw new Error(`SMTP configuration is incomplete. Missing: ${missingEnv.join(', ')}`)
  }

  const port = Number(smtpEnv.SMTP_PORT)

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('SMTP_PORT must be a positive integer.')
  }

  return nodemailerAdapter({
    defaultFromAddress: getEnv('FROM_ADDRESS') || 'noreply@quotify3d.com',
    defaultFromName: getEnv('FROM_NAME') || 'Quotify3D',
    transportOptions: {
      auth: {
        pass: smtpEnv.SMTP_PASS,
        user: smtpEnv.SMTP_USER,
      },
      host: smtpEnv.SMTP_HOST,
      port,
      secure: parseSMTPSecure(),
    },
  })
}

const emailAdapter = getEmailAdapter()

export default buildConfig({
  admin: {
    user: Users.slug,
  },
  bin: [
    {
      key: 'import-configs',
      scriptPath: path.resolve(dirname, 'scripts/import-configs.ts'),
    },
  ],
  collections: [
    Users,
    Pages,
    Categories,
    Media,
    ...configCollections,
    ...catalogCollections,
    ...productionCollections,
    ...operationsCollections,
    Coupons,
    CouponRedemptions,
  ],
  db: sqliteAdapter({
    client: {
      url: process.env.DATABASE_URL || '',
    },
    prodMigrations: shouldRunProdMigrations ? migrations : undefined,
  }),
  editor: lexicalEditor({
    features: () => {
      return [
        UnderlineFeature(),
        BoldFeature(),
        ItalicFeature(),
        OrderedListFeature(),
        UnorderedListFeature(),
        LinkFeature({
          enabledCollections: ['pages'],
          fields: ({ defaultFields }) => {
            const defaultFieldsWithoutUrl = defaultFields.filter((field) => {
              if ('name' in field && field.name === 'url') return false
              return true
            })

            return [
              ...defaultFieldsWithoutUrl,
              {
                name: 'url',
                type: 'text',
                admin: {
                  condition: (_data, siblingData) => siblingData?.linkType !== 'internal',
                },
                label: ({ t }) => t('fields:enterURL'),
                required: true,
                validate: ((value, options) => {
                  if ((options?.siblingData as LinkFields)?.linkType === 'internal') {
                    return true // no validation needed, as no url should exist for internal links
                  }
                  return value ? true : 'URL is required'
                }) as TextFieldSingleValidation,
              },
            ]
          },
        }),
        IndentFeature(),
        EXPERIMENTAL_TableFeature(),
      ]
    },
  }),
  ...(emailAdapter ? { email: emailAdapter } : {}),
  endpoints: [],
  globals: [Header, Footer, SiteSettings],
  plugins,
  secret: process.env.PAYLOAD_SECRET || '',
  jobs: {
    jobsCollectionOverrides: ({ defaultJobsCollection }) => {
      if (!defaultJobsCollection.admin) {
        defaultJobsCollection.admin = {}
      }
      defaultJobsCollection.admin.hidden = false
      return defaultJobsCollection
    },
    autoRun: [
      {
        cron: '* * * * *',
        queue: 'slicing',
      },
    ],
    tasks: [
      {
        slug: 'buildSlicerContextTask',
        inputSchema: [
          {
            name: 'gcodeId',
            type: 'text',
            required: true,
          },
        ],
        outputSchema: [
          {
            name: 'filamentConfigPath',
            type: 'text',
            required: true,
          },
          {
            name: 'processConfigPath',
            type: 'text',
            required: true,
          },
          {
            name: 'machineConfigPath',
            type: 'text',
            required: true,
          },
        ],
        handler: buildSlicerContextTask,
      },
      {
        slug: 'sliceModelTask',
        inputSchema: [
          {
            name: 'gcodeId',
            type: 'text',
            required: true,
          },
          {
            name: 'filamentConfigPath',
            type: 'text',
            required: false,
          },
          {
            name: 'processConfigPath',
            type: 'text',
            required: false,
          },
          {
            name: 'machineConfigPath',
            type: 'text',
            required: false,
          },
        ],
        outputSchema: [
          {
            name: 'gcodePaths',
            type: 'json',
            required: true,
          },
          {
            name: 'slicerOutput',
            type: 'text',
            required: false,
          },
          {
            name: 'commandString',
            type: 'text',
            required: false,
          },
        ],
        handler: sliceModelTask,
      },
      {
        slug: 'extractSlicerMetricsTask',
        inputSchema: [
          {
            name: 'gcodePath',
            type: 'text',
            required: true,
          },
          {
            name: 'gcodeId',
            type: 'text',
            required: true,
          },
          {
            name: 'index',
            type: 'number',
            required: true,
          },
        ],
        outputSchema: [
          {
            name: 'filamentUsedGrams',
            type: 'number',
            required: false,
          },
          {
            name: 'estimatedDuration',
            type: 'number',
            required: false,
          },
          {
            name: 'gcode',
            type: 'text',
            required: false,
          },
        ],
        handler: extractSlicerMetricsTask,
      },
    ],
    workflows: [
      {
        slug: 'sliceGcode',
        queue: 'slicing',
        inputSchema: [
          {
            name: 'gcodeId',
            type: 'text',
            required: true,
          },
        ],
        handler: sliceGcodeWorkflow,
      },
    ],
  },
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  // Sharp is now an optional dependency -
  // if you want to resize images, crop, set focal point, etc.
  // make sure to install it and pass it to the config.
  sharp,
})
