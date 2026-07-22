import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`quotes_items_filament_slots\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`colour_id\` integer NOT NULL,
  	FOREIGN KEY (\`colour_id\`) REFERENCES \`colours\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`quotes_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`quotes_items_filament_slots_order_idx\` ON \`quotes_items_filament_slots\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`quotes_items_filament_slots_parent_id_idx\` ON \`quotes_items_filament_slots\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`quotes_items_filament_slots_colour_idx\` ON \`quotes_items_filament_slots\` (\`colour_id\`);`)
  await db.run(sql`CREATE TABLE \`gcodes_filament_slots\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`colour_id\` integer NOT NULL,
  	FOREIGN KEY (\`colour_id\`) REFERENCES \`colours\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`gcodes\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`gcodes_filament_slots_order_idx\` ON \`gcodes_filament_slots\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`gcodes_filament_slots_parent_id_idx\` ON \`gcodes_filament_slots\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`gcodes_filament_slots_colour_idx\` ON \`gcodes_filament_slots\` (\`colour_id\`);`)
  await db.run(sql`ALTER TABLE \`models\` ADD \`filament_slot_count\` numeric DEFAULT 1;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`quotes_items_filament_slots\`;`)
  await db.run(sql`DROP TABLE \`gcodes_filament_slots\`;`)
  await db.run(sql`ALTER TABLE \`models\` DROP COLUMN \`filament_slot_count\`;`)
}
