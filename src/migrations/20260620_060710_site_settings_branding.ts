import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`DROP TABLE IF EXISTS \`__new_site_settings\`;`)
  await db.run(sql`CREATE TABLE \`__new_site_settings\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`site_name\` text DEFAULT 'Quotify3D',
  	\`company_name\` text DEFAULT 'Quotify3D',
  	\`logo_id\` integer,
  	\`default_open_graph_title\` text DEFAULT 'Quotify3D',
  	\`default_open_graph_description\` text DEFAULT 'Upload a 3D model, compare material and finish options, and request a print quote online.',
  	\`default_open_graph_image_id\` integer,
  	\`quote_product_placeholder_id\` integer,
  	\`updated_at\` text,
  	\`created_at\` text,
  	FOREIGN KEY (\`logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`default_open_graph_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`quote_product_placeholder_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`INSERT INTO \`__new_site_settings\`("id", "site_name", "company_name", "logo_id", "updated_at", "created_at") SELECT "id", "site_name", "company_name", "logo_id", "updated_at", "created_at" FROM \`site_settings\`;`)
  await db.run(sql`DROP TABLE \`site_settings\`;`)
  await db.run(sql`ALTER TABLE \`__new_site_settings\` RENAME TO \`site_settings\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`site_settings_logo_idx\` ON \`site_settings\` (\`logo_id\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_default_open_graph_default_open_graph_imag_idx\` ON \`site_settings\` (\`default_open_graph_image_id\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_quote_product_placeholder_idx\` ON \`site_settings\` (\`quote_product_placeholder_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`DROP TABLE IF EXISTS \`__new_site_settings\`;`)
  await db.run(sql`CREATE TABLE \`__new_site_settings\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`site_name\` text,
  	\`company_name\` text,
  	\`logo_id\` integer,
  	\`updated_at\` text,
  	\`created_at\` text,
  	FOREIGN KEY (\`logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`INSERT INTO \`__new_site_settings\`("id", "site_name", "company_name", "logo_id", "updated_at", "created_at") SELECT "id", "site_name", "company_name", "logo_id", "updated_at", "created_at" FROM \`site_settings\`;`)
  await db.run(sql`DROP TABLE \`site_settings\`;`)
  await db.run(sql`ALTER TABLE \`__new_site_settings\` RENAME TO \`site_settings\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`site_settings_logo_idx\` ON \`site_settings\` (\`logo_id\`);`)
}
