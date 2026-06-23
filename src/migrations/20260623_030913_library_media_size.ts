import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`media\` ADD \`sizes_library_url\` text;`)
  await db.run(sql`ALTER TABLE \`media\` ADD \`sizes_library_width\` numeric;`)
  await db.run(sql`ALTER TABLE \`media\` ADD \`sizes_library_height\` numeric;`)
  await db.run(sql`ALTER TABLE \`media\` ADD \`sizes_library_mime_type\` text;`)
  await db.run(sql`ALTER TABLE \`media\` ADD \`sizes_library_filesize\` numeric;`)
  await db.run(sql`ALTER TABLE \`media\` ADD \`sizes_library_filename\` text;`)
  await db.run(sql`CREATE INDEX \`media_sizes_library_sizes_library_filename_idx\` ON \`media\` (\`sizes_library_filename\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP INDEX \`media_sizes_library_sizes_library_filename_idx\`;`)
  await db.run(sql`ALTER TABLE \`media\` DROP COLUMN \`sizes_library_url\`;`)
  await db.run(sql`ALTER TABLE \`media\` DROP COLUMN \`sizes_library_width\`;`)
  await db.run(sql`ALTER TABLE \`media\` DROP COLUMN \`sizes_library_height\`;`)
  await db.run(sql`ALTER TABLE \`media\` DROP COLUMN \`sizes_library_mime_type\`;`)
  await db.run(sql`ALTER TABLE \`media\` DROP COLUMN \`sizes_library_filesize\`;`)
  await db.run(sql`ALTER TABLE \`media\` DROP COLUMN \`sizes_library_filename\`;`)
}
