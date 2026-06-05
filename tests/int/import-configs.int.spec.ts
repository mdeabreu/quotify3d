import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'

import { type ConfigType, flattenOrcaConfig } from '@/scripts/import-configs'

const tempDirs: string[] = []

function createProcessConfig(configContents: Record<string, unknown>): ConfigType {
  const profilesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quotify3d-import-configs-'))
  tempDirs.push(profilesDir)

  const profile = 'TestProfile'
  const processDir = path.join(profilesDir, profile, 'process')
  fs.mkdirSync(processDir, { recursive: true })

  const configPath = path.join(processDir, '0.20mm Standard.json')
  fs.writeFileSync(
    configPath,
    JSON.stringify({
      name: '0.20mm Standard',
      ...configContents,
    }),
  )

  return {
    name: '0.20mm Standard',
    path: configPath,
    profile,
    profilesDir,
    type: 'process',
  }
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { force: true, recursive: true })
  }
})

describe('flattenOrcaConfig', () => {
  it('adds missing process fallback defaults when enabled', () => {
    const config = createProcessConfig({})

    const flattenedConfig = flattenOrcaConfig(config, true)

    expect(flattenedConfig.raft_first_layer_expansion).toBe('2')
  })

  it('leaves missing process fallback defaults unset when disabled', () => {
    const config = createProcessConfig({})

    const flattenedConfig = flattenOrcaConfig(config, false)

    expect(flattenedConfig.raft_first_layer_expansion).toBeUndefined()
  })

  it('does not overwrite process fallback defaults supplied by the profile', () => {
    const config = createProcessConfig({
      raft_first_layer_expansion: '3.5',
    })

    const flattenedConfig = flattenOrcaConfig(config, true)

    expect(flattenedConfig.raft_first_layer_expansion).toBe('3.5')
  })
})
