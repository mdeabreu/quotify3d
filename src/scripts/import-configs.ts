import type { CollectionSlug, SanitizedConfig } from 'payload'
import payload from 'payload'

import * as p from '@clack/prompts'
import arg from 'arg'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'

type SelectOptionType = {
    label: string
    value: string
}

type ConfigType = {
    name: string
    type: string
    path: string
}

export function printHelp(): void {
    console.log(chalk`
  USAGE

    $ pnpm payload import-configs

    Prompts the user for information including the slicer profile location,
    then it will import the profiles into the database.

  OPTIONS

    -h  Show help
`)
}

type ProfilesDirDefaults = {
    placeholder: string
    defaultValue: string
}

function getProfilesDirDefaults(): ProfilesDirDefaults {
    // Detect OS (OrcaSlicer only for now)
    switch (process.platform) {
        case 'darwin': {
            const macPath = '/Applications/OrcaSlicer.app/Contents/Resources/profiles'
            return { placeholder: macPath, defaultValue: macPath }
        }
        case 'win32': {
            const windowsPath = 'C:\\Program Files\\OrcaSlicer\\resources\\profiles'
            return { placeholder: windowsPath, defaultValue: windowsPath }
        }
        case 'linux': {
            const linuxPath = '/usr/share/orca-slicer/resources/profiles'
            return { placeholder: linuxPath, defaultValue: linuxPath }
        }
        default:
            return { placeholder: '', defaultValue: '' }
    }
}

function getProfiles(profilesDir: string): SelectOptionType[] {
    return fs
        .readdirSync(profilesDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .flatMap((entry) => {
            const profileName = entry.name
            const jsonPath = `${profilesDir}/${profileName}.json`

            if (!fs.existsSync(jsonPath) || !fs.statSync(jsonPath).isFile()) return []

            const data = readJsonFile<{ name?: string }>(jsonPath)
            if (!data) return []

            const label = typeof data.name === 'string' ? data.name : profileName
            return [{ value: profileName, label }]
        })
}

function getProfileTypes(profilesDir: string, selectedProfile: string): SelectOptionType[] {
    const profileDir = path.join(profilesDir, selectedProfile)
    const profileTypes = ['filament', 'machine', 'process']

    return profileTypes.flatMap((profileType) => {
        const typeDir = path.join(profileDir, profileType)

        if (!fs.existsSync(typeDir) || !fs.statSync(typeDir).isDirectory()) return []

        const label = `${profileType[0]?.toUpperCase()}${profileType.slice(1)}`
        return [{ value: profileType, label }]
    })
}

function getConfigsForType(
    profilesDir: string,
    selectedProfile: string,
    selectedType: string,
): SelectOptionType[] {
    const typeDir = path.join(profilesDir, selectedProfile, selectedType)

    if (!fs.existsSync(typeDir) || !fs.statSync(typeDir).isDirectory()) return []

    return fs
        .readdirSync(typeDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .flatMap((entry) => {
            const filePath = path.join(typeDir, entry.name)

            const data = readJsonFile<{
                instantiation?: boolean | string
                name?: string
            }>(filePath)

            if (!data) return []

            const isInstantiation =
                data.instantiation === true ||
                (typeof data.instantiation === 'string' && data.instantiation.toLowerCase() === 'true')

            if (!isInstantiation) return []

            const fileName = path.parse(entry.name).name
            const label = typeof data.name === 'string' ? data.name : fileName

            return [{ value: entry.name, label }]
        })
}

function readJsonFile<T>(filePath: string): T | undefined {
    try {
        const raw = fs.readFileSync(filePath, 'utf8')
        return JSON.parse(raw) as T
    } catch {
        return undefined
    }
}

function loadConfig(
    configPath: string,
    visited: Set<string> = new Set(),
): Record<string, unknown> {
    if (visited.has(configPath)) return {}
    visited.add(configPath)

    const config = readJsonFile<Record<string, unknown> & { inherits?: string }>(configPath)
    if (!config || typeof config !== 'object') return {}

    const inheritedName = typeof config.inherits === 'string' ? config.inherits.trim() : ''
    const { inherits: _inherits, ...current } = config

    if (!inheritedName) return current

    const inheritedPath = path.join(path.dirname(configPath), `${inheritedName}.json`)
    if (!fs.existsSync(inheritedPath) || !fs.statSync(inheritedPath).isFile()) return current

    const inherited = loadConfig(inheritedPath, visited)
    return { ...inherited, ...current }
}

async function selectProfilesDir(): Promise<string | undefined> {
    const profilesDirDefaults = getProfilesDirDefaults()

    const profilesDir = await p.text({
        message: 'Path to profiles directory',
        placeholder: profilesDirDefaults.placeholder,
        defaultValue: profilesDirDefaults.defaultValue,
        validate: (value) => {
            if (value === '') return undefined
            if (!fs.existsSync(value)) return 'Path must exist'
        }
    })

    if (p.isCancel(profilesDir)) return undefined

    return profilesDir as string
}

async function selectProfile(profilesDir: string): Promise<string | undefined> {
    const profileOptions = getProfiles(profilesDir)
    if (profileOptions.length === 0) {
        p.log.warn('No profiles found in that directory.')
        return undefined
    }

    const selectedProfile = await p.select<string>({
        message: 'Profile to import',
        options: profileOptions
    })

    if (p.isCancel(selectedProfile)) return undefined

    return selectedProfile
}

async function selectTypes(
    profilesDir: string,
    selectedProfile: string,
): Promise<string[] | undefined> {
    const configTypesOptions = getProfileTypes(profilesDir, selectedProfile)
    if (configTypesOptions.length === 0) {
        p.log.warn('No config types found for that profile.')
        return undefined
    }

    const selectedTypes = await p.multiselect<string>({
        message: 'Profile types to import',
        options: configTypesOptions
    })

    if (p.isCancel(selectedTypes)) return undefined

    return selectedTypes
}

async function selectConfigs(
    profilesDir: string,
    selectedProfile: string,
    selectedTypes: string[],
): Promise<ConfigType[]> {
    const configs: ConfigType[] = []

    for (const selectedType of selectedTypes) {
        const configOptions = getConfigsForType(
            profilesDir,
            selectedProfile,
            selectedType,
        )

        if (configOptions.length === 0) continue

        const selectedConfigs = await p.multiselect<string>({
            message: `Configs to import (${selectedProfile} - ${selectedType})`,
            options: configOptions
        })

        if (p.isCancel(selectedConfigs)) continue

        for (const selectedConfig of selectedConfigs) {
            configs.push({
                name: path.parse(selectedConfig).name,
                type: selectedType,
                path: path.join(profilesDir, selectedProfile, selectedType, selectedConfig),
            })
        }
    }

    if (configs.length === 0) {
        p.log.warn('No configs selected to import.')
    }

    return configs
}

type ImportSummary = {
    created: number
    updated: number
    skipped: number
}

async function importConfigs(configs: ConfigType[], shouldOverwrite: boolean): Promise<ImportSummary> {
    const spin = p.spinner()
    spin.start()

    const typeToCollection: Record<string, CollectionSlug> = {
        filament: 'filaments',
        machine: 'machines',
        process: 'processes',
    }

    const summary: ImportSummary = { created: 0, updated: 0, skipped: 0 }

    for (const config of configs) {
        spin.message(`Importing ${config.name} (${config.type})`)
        //DEBUG
        await sleep(3000)
        //ENDDEBUG
        const configContents = loadConfig(config.path)

        const collection = typeToCollection[config.type]
        if (!collection) {
            summary.skipped += 1
            continue
        }

        const name = typeof configContents.name === 'string' ? configContents.name : config.name

        const existing = await payload.find({
            collection,
            depth: 0,
            limit: 1,
            where: {
                name: { equals: name },
            },
        })

        const existingDoc = existing.docs[0]

        if (existingDoc) {
            if (!shouldOverwrite) {
                p.log.warn(`Skipping ${name} (${config.type}) - already exists`)
                summary.skipped += 1
                continue
            }

            await payload.update({
                collection,
                id: existingDoc.id,
                data: {
                    name,
                    config: configContents,
                },
            })
            summary.updated += 1
        } else {
            await payload.create({
                collection,
                data: {
                    name,
                    config: configContents,
                },
            })
            summary.created += 1
        }
    }

    spin.stop('Importing complete')
    return summary
}

export const script = async (config: SanitizedConfig) => {
    await payload.init({ config })

    const args = arg(
        {
            '--help': Boolean,

            // Aliases
            '-h': '--help'
        },
        { permissive: true },
    )

    if (args['--help']) {
        printHelp()
        process.exit(0)
    }

    p.intro(chalk.bgCyan(chalk.black(' import-configs ')))
    p.note('Welcome to the config importer!')

    const profilesDir = await selectProfilesDir()
    if (!profilesDir) process.exit(0)

    const selectedProfile = await selectProfile(profilesDir)
    if (!selectedProfile) process.exit(0)

    const selectedTypes = await selectTypes(profilesDir, selectedProfile)
    if (!selectedTypes || selectedTypes.length === 0) process.exit(0)

    const shouldOverwrite = await p.confirm({
        message: 'Overwrite existing configs with the same name?',
        initialValue: false,
    })

    if (p.isCancel(shouldOverwrite)) process.exit(0)

    const configs = await selectConfigs(profilesDir, selectedProfile, selectedTypes)
    if (configs.length === 0) process.exit(0)

    const summary = await importConfigs(configs, shouldOverwrite)

    p.outro(`Imported configs. Created: ${summary.created}, Updated: ${summary.updated}, Skipped: ${summary.skipped}.`)

    process.exit(0)
}

//DEBUG
function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
//ENDDEBUG
