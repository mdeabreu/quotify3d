import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_spools\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`active\` integer DEFAULT true NOT NULL,
  	\`name\` text,
  	\`vendor_id\` integer NOT NULL,
  	\`colour_id\` integer NOT NULL,
  	\`material_id\` integer NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`vendor_id\`) REFERENCES \`vendors\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`colour_id\`) REFERENCES \`colours\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`material_id\`) REFERENCES \`filaments\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(
    sql`INSERT INTO \`__new_spools\`("id", "active", "name", "vendor_id", "colour_id", "material_id", "updated_at", "created_at") SELECT "id", "active", "name", "vendor_id", "colour_id", "material_id", "updated_at", "created_at" FROM \`spools\`;`,
  )
  await db.run(sql`DROP TABLE \`spools\`;`)
  await db.run(sql`ALTER TABLE \`__new_spools\` RENAME TO \`spools\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`spools_vendor_idx\` ON \`spools\` (\`vendor_id\`);`)
  await db.run(sql`CREATE INDEX \`spools_colour_idx\` ON \`spools\` (\`colour_id\`);`)
  await db.run(sql`CREATE INDEX \`spools_material_idx\` ON \`spools\` (\`material_id\`);`)
  await db.run(sql`CREATE INDEX \`spools_updated_at_idx\` ON \`spools\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`spools_created_at_idx\` ON \`spools\` (\`created_at\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_spools\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`active\` integer DEFAULT true NOT NULL,
  	\`name\` text NOT NULL,
  	\`vendor_id\` integer NOT NULL,
  	\`material_id\` integer NOT NULL,
  	\`colour_id\` integer NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`vendor_id\`) REFERENCES \`vendors\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`material_id\`) REFERENCES \`filaments\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`colour_id\`) REFERENCES \`colours\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(
    sql`INSERT INTO \`__new_spools\`("id", "active", "name", "vendor_id", "material_id", "colour_id", "updated_at", "created_at") SELECT "id", "active", "name", "vendor_id", "material_id", "colour_id", "updated_at", "created_at" FROM \`spools\`;`,
  )
  await db.run(sql`DROP TABLE \`spools\`;`)
  await db.run(sql`ALTER TABLE \`__new_spools\` RENAME TO \`spools\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`spools_vendor_idx\` ON \`spools\` (\`vendor_id\`);`)
  await db.run(sql`CREATE INDEX \`spools_material_idx\` ON \`spools\` (\`material_id\`);`)
  await db.run(sql`CREATE INDEX \`spools_colour_idx\` ON \`spools\` (\`colour_id\`);`)
  await db.run(sql`CREATE INDEX \`spools_updated_at_idx\` ON \`spools\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`spools_created_at_idx\` ON \`spools\` (\`created_at\`);`)
}
