import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`footer_nav_groups_links\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`link_type\` text DEFAULT 'reference',
    \`link_new_tab\` integer,
    \`link_url\` text,
    \`link_label\` text NOT NULL,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`footer_nav_groups\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`footer_nav_groups_links_order_idx\` ON \`footer_nav_groups_links\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`footer_nav_groups_links_parent_id_idx\` ON \`footer_nav_groups_links\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`footer_nav_groups\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`label\` text NOT NULL,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`footer\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`footer_nav_groups_order_idx\` ON \`footer_nav_groups\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`footer_nav_groups_parent_id_idx\` ON \`footer_nav_groups\` (\`_parent_id\`);`)
  await db.run(sql`DROP TABLE \`footer_nav_items\`;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`footer_nav_items\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`link_type\` text DEFAULT 'reference',
    \`link_new_tab\` integer,
    \`link_url\` text,
    \`link_label\` text NOT NULL,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`footer\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`footer_nav_items_order_idx\` ON \`footer_nav_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`footer_nav_items_parent_id_idx\` ON \`footer_nav_items\` (\`_parent_id\`);`)
  await db.run(sql`DROP TABLE \`footer_nav_groups_links\`;`)
  await db.run(sql`DROP TABLE \`footer_nav_groups\`;`)
}
