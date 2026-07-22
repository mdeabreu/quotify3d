import * as migration_20260616_012027_initial_schema from './20260616_012027_initial_schema'
import * as migration_20260620_060710_site_settings_branding from './20260620_060710_site_settings_branding'
import * as migration_20260623_022209_media_sizes from './20260623_022209_media_sizes'
import * as migration_20260623_030913_library_media_size from './20260623_030913_library_media_size'
import * as migration_20260702_152108_filament_slots from './20260702_152108_filament_slots'
import * as migration_20260704_023739_colour_notes from './20260704_023739_colour_notes'
import * as migration_20260716_055340_quote_builder_overhaul from './20260716_055340_quote_builder_overhaul'
import * as migration_20260721_062716_nullable_quote_slot_colours from './20260721_062716_nullable_quote_slot_colours'

export const migrations = [
  {
    up: migration_20260616_012027_initial_schema.up,
    down: migration_20260616_012027_initial_schema.down,
    name: '20260616_012027_initial_schema',
  },
  {
    up: migration_20260620_060710_site_settings_branding.up,
    down: migration_20260620_060710_site_settings_branding.down,
    name: '20260620_060710_site_settings_branding',
  },
  {
    up: migration_20260623_022209_media_sizes.up,
    down: migration_20260623_022209_media_sizes.down,
    name: '20260623_022209_media_sizes',
  },
  {
    up: migration_20260623_030913_library_media_size.up,
    down: migration_20260623_030913_library_media_size.down,
    name: '20260623_030913_library_media_size',
  },
  {
    up: migration_20260702_152108_filament_slots.up,
    down: migration_20260702_152108_filament_slots.down,
    name: '20260702_152108_filament_slots',
  },
  {
    up: migration_20260704_023739_colour_notes.up,
    down: migration_20260704_023739_colour_notes.down,
    name: '20260704_023739_colour_notes',
  },
  {
    up: migration_20260716_055340_quote_builder_overhaul.up,
    down: migration_20260716_055340_quote_builder_overhaul.down,
    name: '20260716_055340_quote_builder_overhaul',
  },
  {
    up: migration_20260721_062716_nullable_quote_slot_colours.up,
    down: migration_20260721_062716_nullable_quote_slot_colours.down,
    name: '20260721_062716_nullable_quote_slot_colours',
  },
]
