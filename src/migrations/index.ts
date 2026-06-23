import * as migration_20260616_012027_initial_schema from './20260616_012027_initial_schema';
import * as migration_20260620_060710_site_settings_branding from './20260620_060710_site_settings_branding';
import * as migration_20260623_022209_media_sizes from './20260623_022209_media_sizes';

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
    name: '20260623_022209_media_sizes'
  },
];
