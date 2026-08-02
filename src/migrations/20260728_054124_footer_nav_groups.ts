import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`footer_nav_groups\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`label\` text NOT NULL,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`footer\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(
    sql`CREATE INDEX \`footer_nav_groups_order_idx\` ON \`footer_nav_groups\` (\`_order\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`footer_nav_groups_parent_id_idx\` ON \`footer_nav_groups\` (\`_parent_id\`);`,
  )
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
  await db.run(
    sql`CREATE INDEX \`footer_nav_groups_links_order_idx\` ON \`footer_nav_groups_links\` (\`_order\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`footer_nav_groups_links_parent_id_idx\` ON \`footer_nav_groups_links\` (\`_parent_id\`);`,
  )
  await db.run(sql`INSERT INTO \`footer_nav_groups\` (\`_order\`, \`_parent_id\`, \`id\`, \`label\`)
    SELECT 1, \`_parent_id\`, lower(hex(randomblob(12))), 'Links'
    FROM \`footer_nav_items\`
    GROUP BY \`_parent_id\`;
  `)
  await db.run(sql`INSERT INTO \`footer_nav_groups_links\` (
    \`_order\`, \`_parent_id\`, \`id\`, \`link_type\`, \`link_new_tab\`, \`link_url\`, \`link_label\`
  )
    SELECT
      item.\`_order\`,
      nav_group.\`id\`,
      item.\`id\`,
      item.\`link_type\`,
      item.\`link_new_tab\`,
      item.\`link_url\`,
      item.\`link_label\`
    FROM \`footer_nav_items\` AS item
    INNER JOIN \`footer_nav_groups\` AS nav_group
      ON nav_group.\`_parent_id\` = item.\`_parent_id\` AND nav_group.\`_order\` = 1;
  `)
  await db.run(sql`UPDATE \`footer_rels\`
    SET \`path\` = 'navGroups.0.links.' || substr(\`path\`, length('navItems.') + 1)
    WHERE \`path\` LIKE 'navItems.%.link.reference';
  `)
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
  await db.run(
    sql`CREATE INDEX \`footer_nav_items_order_idx\` ON \`footer_nav_items\` (\`_order\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`footer_nav_items_parent_id_idx\` ON \`footer_nav_items\` (\`_parent_id\`);`,
  )
  await db.run(sql`INSERT INTO \`footer_nav_items\` (
    \`_order\`, \`_parent_id\`, \`id\`, \`link_type\`, \`link_new_tab\`, \`link_url\`, \`link_label\`
  )
    SELECT
      row_number() OVER (
        PARTITION BY nav_group.\`_parent_id\`
        ORDER BY nav_group.\`_order\`, item.\`_order\`
      ),
      nav_group.\`_parent_id\`,
      item.\`id\`,
      item.\`link_type\`,
      item.\`link_new_tab\`,
      item.\`link_url\`,
      item.\`link_label\`
    FROM \`footer_nav_groups\` AS nav_group
    INNER JOIN \`footer_nav_groups_links\` AS item ON item.\`_parent_id\` = nav_group.\`id\`;
  `)
  await db.run(sql`WITH flattened_items AS (
    SELECT
      nav_group.\`_parent_id\` AS footer_id,
      nav_group.\`_order\` - 1 AS group_index,
      item.\`_order\` - 1 AS group_item_index,
      row_number() OVER (
        PARTITION BY nav_group.\`_parent_id\`
        ORDER BY nav_group.\`_order\`, item.\`_order\`
      ) - 1 AS item_index
    FROM \`footer_nav_groups\` AS nav_group
    INNER JOIN \`footer_nav_groups_links\` AS item ON item.\`_parent_id\` = nav_group.\`id\`
  ),
  relation_paths AS (
    SELECT relation.\`id\` AS relation_id, item.item_index
    FROM flattened_items AS item
    INNER JOIN \`footer_rels\` AS relation
      ON relation.\`parent_id\` = item.footer_id
      AND relation.\`path\` =
        'navGroups.' || item.group_index ||
        '.links.' || item.group_item_index || '.link.reference'
  )
  UPDATE \`footer_rels\`
  SET \`path\` = 'navItems.' || (
    SELECT relation_paths.item_index
    FROM relation_paths
    WHERE relation_paths.relation_id = \`footer_rels\`.\`id\`
  ) || '.link.reference'
  WHERE \`id\` IN (SELECT relation_id FROM relation_paths);
  `)
  await db.run(sql`DROP TABLE \`footer_nav_groups_links\`;`)
  await db.run(sql`DROP TABLE \`footer_nav_groups\`;`)
}
