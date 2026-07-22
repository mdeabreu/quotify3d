import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_quotes_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`model_id\` integer NOT NULL,
  	\`quantity\` numeric DEFAULT 1 NOT NULL,
  	\`spool_id\` integer,
  	\`filament_id\` integer,
  	\`colour_id\` integer,
  	\`notes\` text,
  	\`process_id\` integer,
  	\`machine_id\` integer,
  	\`gcode_id\` integer,
  	FOREIGN KEY (\`model_id\`) REFERENCES \`models\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`spool_id\`) REFERENCES \`spools\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`filament_id\`) REFERENCES \`filaments\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`colour_id\`) REFERENCES \`colours\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`process_id\`) REFERENCES \`processes\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`machine_id\`) REFERENCES \`machines\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`gcode_id\`) REFERENCES \`gcodes\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`quotes\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_quotes_items\`("_order", "_parent_id", "id", "model_id", "quantity", "spool_id", "filament_id", "colour_id", "notes", "process_id", "machine_id", "gcode_id") SELECT "_order", "_parent_id", "id", "model_id", "quantity", "spool_id", "filament_id", "colour_id", "colour_notes", "process_id", "machine_id", "gcode_id" FROM \`quotes_items\`;`)
  await db.run(sql`DROP TABLE \`quotes_items\`;`)
  await db.run(sql`ALTER TABLE \`__new_quotes_items\` RENAME TO \`quotes_items\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`quotes_items_order_idx\` ON \`quotes_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`quotes_items_parent_id_idx\` ON \`quotes_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`quotes_items_model_idx\` ON \`quotes_items\` (\`model_id\`);`)
  await db.run(sql`CREATE INDEX \`quotes_items_spool_idx\` ON \`quotes_items\` (\`spool_id\`);`)
  await db.run(sql`CREATE INDEX \`quotes_items_filament_idx\` ON \`quotes_items\` (\`filament_id\`);`)
  await db.run(sql`CREATE INDEX \`quotes_items_colour_idx\` ON \`quotes_items\` (\`colour_id\`);`)
  await db.run(sql`CREATE INDEX \`quotes_items_process_idx\` ON \`quotes_items\` (\`process_id\`);`)
  await db.run(sql`CREATE INDEX \`quotes_items_machine_idx\` ON \`quotes_items\` (\`machine_id\`);`)
  await db.run(sql`CREATE INDEX \`quotes_items_gcode_idx\` ON \`quotes_items\` (\`gcode_id\`);`)
  await db.run(sql`ALTER TABLE \`quotes_items_filament_slots\` ADD \`description\` text;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_quotes_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`model_id\` integer NOT NULL,
  	\`quantity\` numeric DEFAULT 1 NOT NULL,
  	\`spool_id\` integer,
  	\`filament_id\` integer NOT NULL,
  	\`colour_id\` integer NOT NULL,
  	\`colour_notes\` text,
  	\`process_id\` integer NOT NULL,
  	\`machine_id\` integer,
  	\`gcode_id\` integer,
  	FOREIGN KEY (\`model_id\`) REFERENCES \`models\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`spool_id\`) REFERENCES \`spools\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`filament_id\`) REFERENCES \`filaments\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`colour_id\`) REFERENCES \`colours\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`process_id\`) REFERENCES \`processes\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`machine_id\`) REFERENCES \`machines\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`gcode_id\`) REFERENCES \`gcodes\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`quotes\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_quotes_items\`("_order", "_parent_id", "id", "model_id", "quantity", "spool_id", "filament_id", "colour_id", "colour_notes", "process_id", "machine_id", "gcode_id") SELECT "_order", "_parent_id", "id", "model_id", "quantity", "spool_id", "filament_id", "colour_id", "notes", "process_id", "machine_id", "gcode_id" FROM \`quotes_items\`;`)
  await db.run(sql`DROP TABLE \`quotes_items\`;`)
  await db.run(sql`ALTER TABLE \`__new_quotes_items\` RENAME TO \`quotes_items\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`quotes_items_order_idx\` ON \`quotes_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`quotes_items_parent_id_idx\` ON \`quotes_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`quotes_items_model_idx\` ON \`quotes_items\` (\`model_id\`);`)
  await db.run(sql`CREATE INDEX \`quotes_items_spool_idx\` ON \`quotes_items\` (\`spool_id\`);`)
  await db.run(sql`CREATE INDEX \`quotes_items_filament_idx\` ON \`quotes_items\` (\`filament_id\`);`)
  await db.run(sql`CREATE INDEX \`quotes_items_colour_idx\` ON \`quotes_items\` (\`colour_id\`);`)
  await db.run(sql`CREATE INDEX \`quotes_items_process_idx\` ON \`quotes_items\` (\`process_id\`);`)
  await db.run(sql`CREATE INDEX \`quotes_items_machine_idx\` ON \`quotes_items\` (\`machine_id\`);`)
  await db.run(sql`CREATE INDEX \`quotes_items_gcode_idx\` ON \`quotes_items\` (\`gcode_id\`);`)
  await db.run(sql`ALTER TABLE \`quotes_items_filament_slots\` DROP COLUMN \`description\`;`)
}
