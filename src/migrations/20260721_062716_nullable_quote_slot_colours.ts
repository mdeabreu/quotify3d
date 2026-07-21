import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_quotes_items_filament_slots\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`colour_id\` integer,
  	\`description\` text,
  	FOREIGN KEY (\`colour_id\`) REFERENCES \`colours\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`quotes_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(
    sql`INSERT INTO \`__new_quotes_items_filament_slots\`("_order", "_parent_id", "id", "colour_id", "description") SELECT "_order", "_parent_id", "id", "colour_id", "description" FROM \`quotes_items_filament_slots\`;`,
  )
  await db.run(sql`DROP TABLE \`quotes_items_filament_slots\`;`)
  await db.run(
    sql`ALTER TABLE \`__new_quotes_items_filament_slots\` RENAME TO \`quotes_items_filament_slots\`;`,
  )
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(
    sql`CREATE INDEX \`quotes_items_filament_slots_order_idx\` ON \`quotes_items_filament_slots\` (\`_order\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`quotes_items_filament_slots_parent_id_idx\` ON \`quotes_items_filament_slots\` (\`_parent_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`quotes_items_filament_slots_colour_idx\` ON \`quotes_items_filament_slots\` (\`colour_id\`);`,
  )
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_quotes_items_filament_slots\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`colour_id\` integer NOT NULL,
  	\`description\` text,
  	FOREIGN KEY (\`colour_id\`) REFERENCES \`colours\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`quotes_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(
    sql`INSERT INTO \`__new_quotes_items_filament_slots\`("_order", "_parent_id", "id", "colour_id", "description") SELECT "_order", "_parent_id", "id", "colour_id", "description" FROM \`quotes_items_filament_slots\` WHERE "colour_id" IS NOT NULL;`,
  )
  await db.run(sql`DROP TABLE \`quotes_items_filament_slots\`;`)
  await db.run(
    sql`ALTER TABLE \`__new_quotes_items_filament_slots\` RENAME TO \`quotes_items_filament_slots\`;`,
  )
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(
    sql`CREATE INDEX \`quotes_items_filament_slots_order_idx\` ON \`quotes_items_filament_slots\` (\`_order\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`quotes_items_filament_slots_parent_id_idx\` ON \`quotes_items_filament_slots\` (\`_parent_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`quotes_items_filament_slots_colour_idx\` ON \`quotes_items_filament_slots\` (\`colour_id\`);`,
  )
}
