import type { CollectionSlug, SanitizedConfig } from 'payload'
import payload from 'payload'

import * as p from '@clack/prompts'
import arg from 'arg'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'

import { currenciesConfig } from '@/config/currencies'

type SelectOptionType = {
    hint?: string
    label: string
    value: string
}

export type ConfigType = {
    name: string
    type: string
    path: string
    profile: string
    profilesDir: string
}

type OrcaConfigType = 'filament' | 'machine' | 'process'

type OrcaManifestEntry = {
    name?: string
    sub_path?: string
}

type OrcaVendorManifest = {
    filament_list?: OrcaManifestEntry[]
    machine_list?: OrcaManifestEntry[]
    process_list?: OrcaManifestEntry[]
}

type OrcaConfig = Record<string, unknown> & {
    inherits?: string
    instantiation?: boolean | string
    name?: string
}

type ConfigIndexEntry = {
    name: string
    path: string
    subPath: string
    type: OrcaConfigType
}

type ImportMode = 'guided' | 'raw'

type MachineSelection = {
    config: ConfigIndexEntry
    model: string
    nozzle: string
}

type FilamentSelectionOption = {
    config: ConfigIndexEntry
    material: string
    name: string
    vendor: string
}

const FILAMENT_CLI_DEFAULTS: Record<string, string[]> = {
    filament_extruder_variant: ['Direct Drive Standard'],
    filament_retraction_length: ['nil'],
    filament_z_hop: ['nil'],
    filament_z_hop_types: ['nil'],
    filament_retract_lift_above: ['nil'],
    filament_retract_lift_below: ['nil'],
    filament_retract_lift_enforce: ['nil'],
    filament_retract_restart_extra: ['nil'],
    filament_retraction_speed: ['nil'],
    filament_deretraction_speed: ['nil'],
    filament_retraction_minimum_travel: ['nil'],
    filament_retract_when_changing_layer: ['nil'],
    filament_wipe: ['nil'],
    filament_wipe_distance: ['nil'],
    filament_retract_before_wipe: ['nil'],
    filament_long_retractions_when_cut: ['nil'],
    filament_retraction_distances_when_cut: ['nil'],
    long_retractions_when_ec: ['0'],
    retraction_distances_when_ec: ['10'],
    filament_flush_volumetric_speed: ['0'],
    filament_flush_temp: ['0'],
    volumetric_speed_coefficients: [''],
    filament_adaptive_volumetric_speed: ['0'],
    filament_ironing_flow: ['nil'],
    filament_ironing_spacing: ['nil'],
    filament_ironing_inset: ['nil'],
    filament_ironing_speed: ['nil'],
    activate_air_filtration: ['0'],
    activate_air_filtration_during_print: ['1'],
    activate_air_filtration_on_completion: ['1'],
    during_print_exhaust_fan_speed: ['60'],
    complete_print_exhaust_fan_speed: ['80'],
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
    const profileTypes = ['filament', 'machine', 'process']

    return profileTypes.flatMap((profileType) => {
        const configs = getConfigIndexForType(
            profilesDir,
            selectedProfile,
            profileType as OrcaConfigType,
        )

        if (configs.length === 0) return []

        const label = `${profileType[0]?.toUpperCase()}${profileType.slice(1)}`
        return [{ value: profileType, label }]
    })
}

function getConfigsForType(
    profilesDir: string,
    selectedProfile: string,
    selectedType: string,
): SelectOptionType[] {
    return getConfigIndexForType(
        profilesDir,
        selectedProfile,
        selectedType as OrcaConfigType,
    ).flatMap((config) => {
        const data = readJsonFile<OrcaConfig>(config.path)

        if (!data || !isInstantiation(data.instantiation)) return []

        return [{ value: config.name, label: config.name }]
    })
}

function getInstantiatedConfigIndexForType(
    profilesDir: string,
    selectedProfile: string,
    type: OrcaConfigType,
): ConfigIndexEntry[] {
    return getConfigIndexForType(profilesDir, selectedProfile, type).filter((config) => {
        const data = readJsonFile<OrcaConfig>(config.path)
        return Boolean(data && isInstantiation(data.instantiation))
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

function isInstantiation(value: unknown): boolean {
    return value === true || (typeof value === 'string' && value.toLowerCase() === 'true')
}

function getStringValue(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()

    if (Array.isArray(value)) {
        const firstValue = value.find((item) => typeof item === 'string' && item.trim().length > 0)
        if (typeof firstValue === 'string') return firstValue.trim()
    }

    return undefined
}

function getStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return []

    return value.filter((item): item is string => typeof item === 'string')
}

function toConfigType(
    config: ConfigIndexEntry,
    profilesDir: string,
    selectedProfile: string,
): ConfigType {
    return {
        name: config.name,
        type: config.type,
        path: config.path,
        profile: selectedProfile,
        profilesDir,
    }
}

function compareByLabel(left: SelectOptionType, right: SelectOptionType): number {
    return left.label.localeCompare(right.label, undefined, { numeric: true, sensitivity: 'base' })
}

function parseLayerHeight(profileName: string): number {
    const match = profileName.match(/^(\d+(?:\.\d+)?)mm\b/)
    if (!match) return Number.POSITIVE_INFINITY

    return Number(match[1])
}

function compareProcessProfiles(left: ConfigIndexEntry, right: ConfigIndexEntry): number {
    return parseLayerHeight(left.name) - parseLayerHeight(right.name)
        || left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' })
}

function getNozzleLabel(config: OrcaConfig): string | undefined {
    return getStringValue(config.printer_variant)
        ?? getStringValue(config.nozzle_diameter)
}

function getFallbackVendor(config: ConfigIndexEntry): string {
    const subPathParts = config.subPath.split(path.sep)
    const fileName = path.parse(config.subPath).name

    if (subPathParts.length > 2) return subPathParts[1] ?? 'Unknown'

    const namePrefix = fileName.split(' @')[0]?.trim()
    const firstWord = namePrefix?.split(' ')[0]?.trim()

    return firstWord || 'Unknown'
}

function flattenIndexedConfig(
    config: ConfigIndexEntry,
    profilesDir: string,
    selectedProfile: string,
): Record<string, unknown> {
    return flattenOrcaConfig(
        toConfigType(config, profilesDir, selectedProfile),
        false,
    )
}

function isCompatibleWithMachine(
    config: ConfigIndexEntry,
    profilesDir: string,
    selectedProfile: string,
    machineName: string,
): boolean {
    const data = flattenIndexedConfig(config, profilesDir, selectedProfile)
    return getStringArray(data.compatible_printers).includes(machineName)
}

function getManifestListKey(type: OrcaConfigType): keyof OrcaVendorManifest {
    switch (type) {
        case 'filament':
            return 'filament_list'
        case 'machine':
            return 'machine_list'
        case 'process':
            return 'process_list'
    }
}

function readVendorManifest(profilesDir: string, selectedProfile: string): OrcaVendorManifest | undefined {
    const manifestPath = path.join(profilesDir, `${selectedProfile}.json`)
    return readJsonFile<OrcaVendorManifest>(manifestPath)
}

export function getConfigIndexForType(
    profilesDir: string,
    selectedProfile: string,
    type: OrcaConfigType,
): ConfigIndexEntry[] {
    const manifest = readVendorManifest(profilesDir, selectedProfile)
    const manifestList = manifest?.[getManifestListKey(type)]

    if (Array.isArray(manifestList)) {
        return manifestList.flatMap((entry) => {
            if (typeof entry.name !== 'string' || typeof entry.sub_path !== 'string') return []

            const configPath = path.join(profilesDir, selectedProfile, entry.sub_path)
            if (!fs.existsSync(configPath) || !fs.statSync(configPath).isFile()) return []

            return [{
                name: entry.name,
                path: configPath,
                subPath: entry.sub_path,
                type,
            }]
        })
    }

    return getConfigIndexFromFiles(profilesDir, selectedProfile, type)
}

function getConfigIndexFromFiles(
    profilesDir: string,
    selectedProfile: string,
    type: OrcaConfigType,
): ConfigIndexEntry[] {
    const typeDir = path.join(profilesDir, selectedProfile, type)

    if (!fs.existsSync(typeDir) || !fs.statSync(typeDir).isDirectory()) return []

    return walkJsonFiles(typeDir).flatMap((configPath) => {
        const data = readJsonFile<OrcaConfig>(configPath)
        const name = typeof data?.name === 'string'
            ? data.name
            : path.parse(configPath).name

        return [{
            name,
            path: configPath,
            subPath: path.relative(path.join(profilesDir, selectedProfile), configPath),
            type,
        }]
    })
}

function walkJsonFiles(dir: string): string[] {
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .flatMap((entry) => {
            const entryPath = path.join(dir, entry.name)

            if (entry.isDirectory()) return walkJsonFiles(entryPath)
            if (entry.isFile() && entry.name.endsWith('.json')) return [entryPath]

            return []
        })
}

function getConfigIndexByName(
    profilesDir: string,
    selectedProfile: string,
    type: OrcaConfigType,
): Map<string, ConfigIndexEntry> {
    const baseConfigs = type === 'filament' && selectedProfile !== 'OrcaFilamentLibrary'
        ? getConfigIndexForType(profilesDir, 'OrcaFilamentLibrary', type)
        : []
    const selectedConfigs = getConfigIndexForType(profilesDir, selectedProfile, type)

    return new Map(
        [...baseConfigs, ...selectedConfigs]
            .map((config) => [config.name, config]),
    )
}

export function flattenOrcaConfig(
    config: ConfigType,
    applyMissingCliDefaults = false,
    indexByName = getConfigIndexByName(
        config.profilesDir,
        config.profile,
        config.type as OrcaConfigType,
    ),
    visited: Set<string> = new Set(),
): Record<string, unknown> {
    const configContents = readJsonFile<OrcaConfig>(config.path)
    if (!configContents || typeof configContents !== 'object') return {}

    const configName = typeof configContents.name === 'string' ? configContents.name : config.name
    if (visited.has(configName)) {
        throw new Error(`Circular inherits chain detected for ${configName}`)
    }

    visited.add(configName)

    const inheritedName = typeof configContents.inherits === 'string'
        ? configContents.inherits.trim()
        : ''

    if (!inheritedName) {
        visited.delete(configName)
        return applyPostMergeDefaults(
            { ...configContents },
            config,
            config.type as OrcaConfigType,
            applyMissingCliDefaults,
        )
    }

    const inherited = indexByName.get(inheritedName)
    if (!inherited) {
        throw new Error(`Could not find inherited profile "${inheritedName}" for "${configName}"`)
    }

    const inheritedContents = flattenOrcaConfig(
        {
            name: inherited.name,
            path: inherited.path,
            profile: config.profile,
            profilesDir: config.profilesDir,
            type: inherited.type,
        },
        applyMissingCliDefaults,
        indexByName,
        visited,
    )

    visited.delete(configName)

    return applyPostMergeDefaults({
        ...inheritedContents,
        ...configContents,
    }, config, config.type as OrcaConfigType, applyMissingCliDefaults)
}

function applyPostMergeDefaults(
    configContents: Record<string, unknown>,
    config: ConfigType,
    type: OrcaConfigType,
    applyMissingCliDefaults: boolean,
): Record<string, unknown> {
    applyMachineModelDefaults(configContents, config, type)
    applyCliDefaults(configContents, type, applyMissingCliDefaults)

    return configContents
}

function applyMachineModelDefaults(
    configContents: Record<string, unknown>,
    config: ConfigType,
    type: OrcaConfigType,
): void {
    if (type !== 'machine') return

    const printerModel = getStringValue(configContents.printer_model)
    if (!printerModel) return

    const modelConfigPath = path.join(config.profilesDir, config.profile, 'machine', `${printerModel}.json`)
    const modelConfig = readJsonFile<OrcaConfig>(modelConfigPath)
    if (!modelConfig) return

    const defaultBedType = getStringValue(modelConfig.default_bed_type)
    if (!defaultBedType) return

    if (configContents.default_bed_type === undefined) {
        configContents.default_bed_type = defaultBedType
    }

    if (configContents.curr_bed_type === undefined) {
        configContents.curr_bed_type = defaultBedType
    }
}

function applyCliDefaults(
    configContents: Record<string, unknown>,
    type: OrcaConfigType,
    applyMissingCliDefaults: boolean,
): Record<string, unknown> {
    if (!applyMissingCliDefaults || type !== 'filament') return configContents

    for (const [key, value] of Object.entries(FILAMENT_CLI_DEFAULTS)) {
        if (configContents[key] === undefined) {
            configContents[key] = value
        }
    }

    return configContents
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

async function selectImportMode(): Promise<ImportMode | undefined> {
    const importMode = await p.select<ImportMode>({
        message: 'Import mode',
        options: [
            {
                label: 'Guided compatible import',
                value: 'guided',
                hint: 'Choose a machine/nozzle, then compatible profiles',
            },
            {
                label: 'Raw type-by-type import',
                value: 'raw',
                hint: 'Browse machine, filament, and process lists directly',
            },
        ],
        initialValue: 'guided',
    })

    if (p.isCancel(importMode)) return undefined

    return importMode
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

async function selectGuidedConfigs(
    profilesDir: string,
    selectedProfile: string,
): Promise<ConfigType[]> {
    const selectedMachine = await selectGuidedMachine(profilesDir, selectedProfile)
    if (!selectedMachine) return []

    const processConfigs = await selectCompatibleProcesses(
        profilesDir,
        selectedProfile,
        selectedMachine.config.name,
    )
    if (!processConfigs) return []

    const filamentConfigs = await selectCompatibleFilaments(
        profilesDir,
        selectedProfile,
        selectedMachine.config.name,
    )
    if (!filamentConfigs) return []

    const configs = [
        toConfigType(selectedMachine.config, profilesDir, selectedProfile),
        ...processConfigs,
        ...filamentConfigs,
    ]

    p.note(
        [
            `Machine: ${selectedMachine.config.name}`,
            `Processes: ${processConfigs.length}`,
            `Filaments: ${filamentConfigs.length}`,
        ].join('\n'),
        'Selected configs',
    )

    return configs
}

async function selectGuidedMachine(
    profilesDir: string,
    selectedProfile: string,
): Promise<MachineSelection | undefined> {
    const machines = getInstantiatedConfigIndexForType(profilesDir, selectedProfile, 'machine')
        .flatMap((config): MachineSelection[] => {
            const data = readJsonFile<OrcaConfig>(config.path)
            const model = getStringValue(data?.printer_model)
            const nozzle = data ? getNozzleLabel(data) : undefined

            if (!model || !nozzle) return []

            return [{ config, model, nozzle }]
        })

    if (machines.length === 0) {
        p.log.warn('No instantiated machine profiles with model and nozzle metadata found.')
        return undefined
    }

    const modelOptions = Array.from(new Set(machines.map((machine) => machine.model)))
        .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }))
        .map((model) => ({
            label: model,
            value: model,
            hint: `${machines.filter((machine) => machine.model === model).length} nozzle profile(s)`,
        }))

    const selectedModel = await p.select<string>({
        message: 'Printer model',
        options: modelOptions,
    })

    if (p.isCancel(selectedModel)) return undefined

    const nozzleMachines = machines
        .filter((machine) => machine.model === selectedModel)
        .sort((left, right) => left.nozzle.localeCompare(right.nozzle, undefined, { numeric: true }))

    const selectedNozzle = await p.select<string>({
        message: `Nozzle size (${selectedModel})`,
        options: nozzleMachines.map((machine) => ({
            label: `${machine.nozzle} mm`,
            value: machine.config.path,
            hint: machine.config.name,
        })),
    })

    if (p.isCancel(selectedNozzle)) return undefined

    return nozzleMachines.find((machine) => machine.config.path === selectedNozzle)
}

async function selectCompatibleProcesses(
    profilesDir: string,
    selectedProfile: string,
    machineName: string,
): Promise<ConfigType[] | undefined> {
    const processConfigs = getInstantiatedConfigIndexForType(profilesDir, selectedProfile, 'process')
        .filter((config) => isCompatibleWithMachine(config, profilesDir, selectedProfile, machineName))
        .sort(compareProcessProfiles)

    if (processConfigs.length === 0) {
        p.log.warn(`No compatible process profiles found for ${machineName}.`)
        return []
    }

    const selectedProcesses = await p.multiselect<string>({
        message: `Compatible process profiles (${machineName})`,
        options: processConfigs.map((config) => ({
            label: config.name,
            value: config.path,
            hint: Number.isFinite(parseLayerHeight(config.name))
                ? `${parseLayerHeight(config.name).toFixed(2)} mm`
                : undefined,
        })),
        required: false,
    })

    if (p.isCancel(selectedProcesses)) return undefined

    const selectedProcessPaths = new Set(selectedProcesses)
    return processConfigs
        .filter((config) => selectedProcessPaths.has(config.path))
        .map((config) => toConfigType(config, profilesDir, selectedProfile))
}

async function selectCompatibleFilaments(
    profilesDir: string,
    selectedProfile: string,
    machineName: string,
): Promise<ConfigType[] | undefined> {
    const filamentOptions = getCompatibleFilamentSelectionOptions(
        profilesDir,
        selectedProfile,
        machineName,
    )

    if (filamentOptions.length === 0) {
        p.log.warn(`No compatible filament profiles found for ${machineName}.`)
        return []
    }

    const materialCounts = getCountsByValue(filamentOptions.map((option) => option.material))
    const selectedMaterials = await p.multiselect<string>({
        message: `Filament materials (${machineName})`,
        options: Array.from(materialCounts.entries())
            .map(([material, count]) => ({
                label: material,
                value: material,
                hint: `${count} profile(s)`,
            }))
            .sort(compareByLabel),
    })

    if (p.isCancel(selectedMaterials)) return undefined

    const selectedMaterialSet = new Set(selectedMaterials)
    const materialFilteredOptions = filamentOptions
        .filter((option) => selectedMaterialSet.has(option.material))

    const vendorCounts = getCountsByValue(materialFilteredOptions.map((option) => option.vendor))
    const selectedVendors = await p.multiselect<string>({
        message: 'Filament vendors',
        options: Array.from(vendorCounts.entries())
            .map(([vendor, count]) => ({
                label: vendor,
                value: vendor,
                hint: `${count} profile(s)`,
            }))
            .sort(compareByLabel),
    })

    if (p.isCancel(selectedVendors)) return undefined

    const selectedVendorSet = new Set(selectedVendors)
    const finalFilamentOptions = materialFilteredOptions
        .filter((option) => selectedVendorSet.has(option.vendor))
        .sort((left, right) => left.material.localeCompare(right.material, undefined, { numeric: true, sensitivity: 'base' })
            || left.vendor.localeCompare(right.vendor, undefined, { numeric: true, sensitivity: 'base' })
            || left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' }))

    const selectedFilaments = await p.multiselect<string>({
        message: 'Compatible filament profiles',
        options: finalFilamentOptions.map((option) => ({
            label: option.name,
            value: option.config.path,
            hint: `${option.material} / ${option.vendor}`,
        })),
        required: false,
    })

    if (p.isCancel(selectedFilaments)) return undefined

    const selectedFilamentPaths = new Set(selectedFilaments)
    return finalFilamentOptions
        .filter((option) => selectedFilamentPaths.has(option.config.path))
        .map((option) => toConfigType(option.config, profilesDir, selectedProfile))
}

export function getCompatibleFilamentSelectionOptions(
    profilesDir: string,
    selectedProfile: string,
    machineName: string,
): FilamentSelectionOption[] {
    return getInstantiatedConfigIndexForType(profilesDir, selectedProfile, 'filament')
        .flatMap((config): FilamentSelectionOption[] => {
            const flattenedConfig = flattenIndexedConfig(config, profilesDir, selectedProfile)
            if (!getStringArray(flattenedConfig.compatible_printers).includes(machineName)) {
                return []
            }

            const material = getStringValue(flattenedConfig.filament_type) ?? 'Unknown'
            const vendor = getStringValue(flattenedConfig.filament_vendor) ?? getFallbackVendor(config)

            return [{
                config,
                material,
                name: config.name,
                vendor,
            }]
        })
}

function getCountsByValue(values: string[]): Map<string, number> {
    return values.reduce<Map<string, number>>((counts, value) => {
        counts.set(value, (counts.get(value) ?? 0) + 1)
        return counts
    }, new Map())
}

async function selectRawConfigs(
    profilesDir: string,
    selectedProfile: string,
): Promise<ConfigType[]> {
    const selectedTypes = await selectTypes(profilesDir, selectedProfile)
    if (!selectedTypes || selectedTypes.length === 0) return []

    return selectConfigs(profilesDir, selectedProfile, selectedTypes)
}

async function selectConfigs(
    profilesDir: string,
    selectedProfile: string,
    selectedTypes: string[],
): Promise<ConfigType[]> {
    const configs: ConfigType[] = []

    for (const selectedType of selectedTypes) {
        const configIndexByName = getConfigIndexByName(
            profilesDir,
            selectedProfile,
            selectedType as OrcaConfigType,
        )
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
            const indexedConfig = configIndexByName.get(selectedConfig)
            if (!indexedConfig) continue

            configs.push({
                name: indexedConfig.name,
                type: selectedType,
                path: indexedConfig.path,
                profile: selectedProfile,
                profilesDir,
            })
        }
    }

    if (configs.length === 0) {
        p.log.warn('No configs selected to import.')
    }

    return configs
}

type ImportSummary = {
    configs: OperationCounts
    catalogItems: OperationCounts
}

type OperationCounts = {
    created: number
    updated: number
    skipped: number
}

type ImportedConfigResult = {
    collection: CollectionSlug
    configDocID: number
    configContents: Record<string, unknown>
    name: string
    status: keyof OperationCounts
    type: string
}

type ExistingDocShape = {
    id: number
    name?: string | null
}

type CatalogPricing = {
    filamentPricePerGram?: number
    machinePricePerHour?: number
}

function getEmptyCounts(): OperationCounts {
    return { created: 0, updated: 0, skipped: 0 }
}

function parseNonNegativeNumber(value: string): number | undefined {
    const trimmed = value.trim()
    if (trimmed.length === 0) return undefined

    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed) || parsed < 0) return undefined

    return parsed
}

function parseNonNegativeCurrencyAmount(value: string): number | undefined {
    const parsed = parseNonNegativeNumber(value)
    if (typeof parsed === 'undefined') return undefined

    const defaultCurrency = currenciesConfig.supportedCurrencies.find(
        (currency) => currency.code === currenciesConfig.defaultCurrency,
    )
    const decimals = defaultCurrency?.decimals ?? 2
    const multiplier = 10 ** decimals

    return Math.round(parsed * multiplier)
}

async function importConfigs(
    configs: ConfigType[],
    shouldOverwrite: boolean,
    applyMissingCliDefaults: boolean,
): Promise<ImportedConfigResult[]> {
    const spin = p.spinner()
    spin.start()

    const typeToCollection: Record<string, CollectionSlug> = {
        filament: 'filament-configs',
        machine: 'machine-configs',
        process: 'process-configs',
    }

    const results: ImportedConfigResult[] = []

    for (const config of configs) {
        spin.message(`Importing ${config.name} (${config.type})`)
        const configContents = flattenOrcaConfig(config, applyMissingCliDefaults)

        const collection = typeToCollection[config.type]
        if (!collection) {
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

        const existingDoc = existing.docs[0] as ExistingDocShape | undefined

        if (existingDoc) {
            if (!shouldOverwrite) {
                p.log.warn(`Skipping ${name} (${config.type}) - already exists`)
                results.push({
                    collection,
                    configDocID: existingDoc.id,
                    configContents,
                    name,
                    status: 'skipped',
                    type: config.type,
                })
                continue
            }

            const updatedDoc = await payload.update({
                collection,
                id: existingDoc.id,
                data: {
                    name,
                    config: configContents,
                },
            })

            results.push({
                collection,
                configContents,
                configDocID: updatedDoc.id,
                name,
                status: 'updated',
                type: config.type,
            })
        } else {
            const createdDoc = await payload.create({
                collection,
                data: {
                    name,
                    config: configContents,
                },
            })

            results.push({
                collection,
                configContents,
                configDocID: createdDoc.id,
                name,
                status: 'created',
                type: config.type,
            })
        }
    }

    spin.stop('Importing complete')
    return results
}

async function shouldCreateCatalogItems(): Promise<boolean | undefined> {
    const result = await p.confirm({
        message: 'Also create or update matching catalog items?',
        initialValue: false,
    })

    if (p.isCancel(result)) return undefined

    return result
}

async function shouldApplyMissingCliDefaults(configs: ConfigType[]): Promise<boolean | undefined> {
    const hasFilaments = configs.some((config) => config.type === 'filament')
    if (!hasFilaments) return false

    const result = await p.confirm({
        message: 'Apply Orca CLI fallback defaults for missing filament keys?',
        initialValue: true,
    })

    if (p.isCancel(result)) return undefined

    return result
}

async function promptForPrice(message: string): Promise<number | undefined> {
    const result = await p.text({
        message,
        defaultValue: '0',
        placeholder: '0.00',
        validate: (value) => {
            if (typeof parseNonNegativeCurrencyAmount(value) === 'undefined') {
                return 'Enter a non-negative currency amount'
            }

            return undefined
        },
    })

    if (p.isCancel(result)) return undefined

    return parseNonNegativeCurrencyAmount(result as string)
}

async function selectCatalogPricing(configs: ConfigType[]): Promise<CatalogPricing | undefined> {
    const hasFilaments = configs.some((config) => config.type === 'filament')
    const hasMachines = configs.some((config) => config.type === 'machine')

    const pricing: CatalogPricing = {}

    if (hasMachines) {
        const machinePricePerHour = await promptForPrice('Price per hour for imported machines')
        if (typeof machinePricePerHour === 'undefined') return undefined

        pricing.machinePricePerHour = machinePricePerHour
    }

    if (hasFilaments) {
        const filamentPricePerGram = await promptForPrice('Price per gram for imported filaments')
        if (typeof filamentPricePerGram === 'undefined') return undefined

        pricing.filamentPricePerGram = filamentPricePerGram
    }

    return pricing
}

async function createCatalogItems(
    importedConfigs: ImportedConfigResult[],
    shouldOverwrite: boolean,
    pricing: CatalogPricing,
): Promise<OperationCounts> {
    const spin = p.spinner()
    spin.start()

    const typeToCollection: Record<string, CollectionSlug> = {
        filament: 'filaments',
        machine: 'machines',
        process: 'processes',
    }

    const summary = getEmptyCounts()

    for (const importedConfig of importedConfigs) {
        const collection = typeToCollection[importedConfig.type]

        if (!collection) {
            continue
        }

        spin.message(`Syncing catalog item for ${importedConfig.name} (${importedConfig.type})`)

        const existing = await payload.find({
            collection,
            depth: 0,
            limit: 1,
            where: {
                name: { equals: importedConfig.name },
            },
        })

        const existingDoc = existing.docs[0] as ExistingDocShape | undefined

        if (existingDoc) {
            if (!shouldOverwrite) {
                p.log.warn(`Skipping catalog item ${importedConfig.name} (${importedConfig.type}) - already exists`)
                summary.skipped += 1
                continue
            }

            const data: Record<string, unknown> = {
                name: importedConfig.name,
                config: importedConfig.configDocID,
            }

            if (collection === 'filaments' && typeof pricing.filamentPricePerGram === 'number') {
                data.pricePerGram = pricing.filamentPricePerGram
            }

            if (collection === 'machines' && typeof pricing.machinePricePerHour === 'number') {
                data.pricePerHour = pricing.machinePricePerHour
            }

            await payload.update({
                collection,
                id: existingDoc.id,
                data,
            })

            summary.updated += 1
            continue
        }

        const data: Record<string, unknown> = {
            active: false,
            config: importedConfig.configDocID,
            name: importedConfig.name,
        }

        if (collection === 'filaments') {
            data.pricePerGram = pricing.filamentPricePerGram ?? 0
        }

        if (collection === 'machines') {
            data.pricePerHour = pricing.machinePricePerHour ?? 0
        }

        await payload.create({
            collection,
            data,
        })

        summary.created += 1
    }

    spin.stop('Catalog sync complete')
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

    const importMode = await selectImportMode()
    if (!importMode) process.exit(0)

    const configs = importMode === 'guided'
        ? await selectGuidedConfigs(profilesDir, selectedProfile)
        : await selectRawConfigs(profilesDir, selectedProfile)

    if (configs.length === 0) process.exit(0)

    const shouldOverwrite = await p.confirm({
        message: 'Overwrite existing configs with the same name?',
        initialValue: false,
    })

    if (p.isCancel(shouldOverwrite)) process.exit(0)

    const applyMissingCliDefaults = await shouldApplyMissingCliDefaults(configs)
    if (typeof applyMissingCliDefaults === 'undefined') process.exit(0)

    const createCatalogItemsResult = await shouldCreateCatalogItems()
    if (typeof createCatalogItemsResult === 'undefined') process.exit(0)

    const catalogPricing = createCatalogItemsResult
        ? await selectCatalogPricing(configs)
        : undefined

    if (createCatalogItemsResult && typeof catalogPricing === 'undefined') process.exit(0)

    const importedConfigs = await importConfigs(configs, shouldOverwrite, applyMissingCliDefaults)

    const summary: ImportSummary = {
        configs: importedConfigs.reduce<OperationCounts>((counts, importedConfig) => {
            counts[importedConfig.status] += 1
            return counts
        }, getEmptyCounts()),
        catalogItems: createCatalogItemsResult
            ? await createCatalogItems(importedConfigs, shouldOverwrite, catalogPricing ?? {})
            : getEmptyCounts(),
    }

    p.outro(
        [
            'Import complete.',
            `Configs -> Created: ${summary.configs.created}, Updated: ${summary.configs.updated}, Skipped: ${summary.configs.skipped}.`,
            `Catalog items -> Created: ${summary.catalogItems.created}, Updated: ${summary.catalogItems.updated}, Skipped: ${summary.catalogItems.skipped}.`,
        ].join('\n'),
    )

    process.exit(0)
}
