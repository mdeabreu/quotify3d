import { sqliteAdapter } from '@payloadcms/db-sqlite'
import {
  BoldFeature,
  EXPERIMENTAL_TableFeature,
  IndentFeature,
  ItalicFeature,
  LinkFeature,
  OrderedListFeature,
  UnderlineFeature,
  UnorderedListFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { Categories } from '@/collections/Categories'
import { Colours } from '@/collections/Colours'
import { FilamentConfigs } from '@/collections/FilamentConfigs'
import { Filaments } from '@/collections/Filaments'
import { MachineConfigs } from '@/collections/MachineConfigs'
import { Materials } from '@/collections/Materials'
import { Media } from '@/collections/Media'
import { Models } from '@/collections/Models'
import { Pages } from '@/collections/Pages'
import { Proccesses } from '@/collections/Proccesses'
import { ProcessConfigs } from '@/collections/ProcessConfigs'
import { Quotes } from '@/collections/Quotes'
import { Users } from '@/collections/Users'
import { Vendors } from '@/collections/Vendors'
import { Gcodes } from '@/collections/Gcodes'
import { Footer } from '@/globals/Footer'
import { Header } from '@/globals/Header'
import { collectSliceContext } from '@/lib/jobs/tasks/collectSliceContext'
import { parseGcodeTask } from '@/lib/jobs/tasks/parseGcodeTask'
import { runSlicerTask } from '@/lib/jobs/tasks/runSlicerTask'
import { sliceGcodeWorkflow } from '@/lib/jobs/workflows/sliceGcode'
import { plugins } from './plugins'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const configCollections = [ProcessConfigs, MachineConfigs, FilamentConfigs]
const catalogCollections = [Colours, Materials, Proccesses]
const productionCollections = [Models, Quotes, Gcodes]
const operationsCollections = [Filaments, Vendors]

export default buildConfig({
  admin: {
    components: {
      // The `BeforeLogin` component renders a message that you see while logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below and the import `BeforeLogin` statement on line 15.
      beforeLogin: ['@/components/BeforeLogin#BeforeLogin'],
      // The `BeforeDashboard` component renders the 'welcome' block that you see after logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below and the import `BeforeDashboard` statement on line 15.
      beforeDashboard: ['@/components/BeforeDashboard#BeforeDashboard'],
    },
    user: Users.slug,
  },
  bin: [
    {
      key: 'import-configs',
      scriptPath: path.resolve(dirname, 'scripts/import-configs.ts'),
    }
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
  ],
  db: sqliteAdapter({
    client: {
      url: process.env.DATABASE_URL || '',
    },
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
                  condition: ({ linkType }) => linkType !== 'internal',
                },
                label: ({ t }) => t('fields:enterURL'),
                required: true,
              },
            ]
          },
        }),
        IndentFeature(),
        EXPERIMENTAL_TableFeature(),
      ]
    },
  }),
  //email: nodemailerAdapter(),
  endpoints: [],
  globals: [Header, Footer],
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
        slug: 'collectSliceContext',
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
        handler: collectSliceContext,
      },
      {
        slug: 'runSlicer',
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
        ],
        handler: runSlicerTask,
      },
      {
        slug: 'parseGcode',
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
        ],
        handler: parseGcodeTask,
      },
    ],
    workflows: [
      {
        slug: 'sliceGcode',
        queue: 'slicing',
        retries: 5,
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
  // sharp,
})
