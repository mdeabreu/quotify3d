import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`fulfillment_settings\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`pickup_enabled\` integer DEFAULT true,
    \`pickup_label\` text DEFAULT 'Local pickup' NOT NULL,
    \`pickup_checkout_description\` text DEFAULT 'Pickup details will be sent to you when your order is ready for collection.' NOT NULL,
    \`pickup_ready_instructions\` text,
    \`updated_at\` text,
    \`created_at\` text
  );
  `)
  await db.run(
    sql`ALTER TABLE \`carts\` ADD \`fulfillment_method\` text DEFAULT 'pickup' NOT NULL;`,
  )
  await db.run(sql`ALTER TABLE \`carts\` ADD \`pickup_contact_first_name\` text;`)
  await db.run(sql`ALTER TABLE \`carts\` ADD \`pickup_contact_last_name\` text;`)
  await db.run(sql`ALTER TABLE \`carts\` ADD \`pickup_contact_phone\` text;`)
  await db.run(
    sql`ALTER TABLE \`orders\` ADD \`fulfillment_method\` text DEFAULT 'pickup' NOT NULL;`,
  )
  await db.run(sql`ALTER TABLE \`orders\` ADD \`pickup_contact_first_name\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`pickup_contact_last_name\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`pickup_contact_phone\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`ready_for_pickup\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`ready_for_pickup_at\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`ready_for_pickup_email_sent_at\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`pickup_instructions_snapshot\` text;`)
  await db.run(
    sql`ALTER TABLE \`transactions\` ADD \`fulfillment_method\` text DEFAULT 'pickup' NOT NULL;`,
  )
  await db.run(sql`ALTER TABLE \`transactions\` ADD \`pickup_contact_first_name\` text;`)
  await db.run(sql`ALTER TABLE \`transactions\` ADD \`pickup_contact_last_name\` text;`)
  await db.run(sql`ALTER TABLE \`transactions\` ADD \`pickup_contact_phone\` text;`)
  await db.run(sql`UPDATE \`transactions\` SET \`fulfillment_method\` = 'shipping'`)
  await db.run(sql`UPDATE \`orders\` SET \`fulfillment_method\` = 'shipping'`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`fulfillment_settings\`;`)
  await db.run(sql`ALTER TABLE \`carts\` DROP COLUMN \`fulfillment_method\`;`)
  await db.run(sql`ALTER TABLE \`carts\` DROP COLUMN \`pickup_contact_first_name\`;`)
  await db.run(sql`ALTER TABLE \`carts\` DROP COLUMN \`pickup_contact_last_name\`;`)
  await db.run(sql`ALTER TABLE \`carts\` DROP COLUMN \`pickup_contact_phone\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`fulfillment_method\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`pickup_contact_first_name\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`pickup_contact_last_name\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`pickup_contact_phone\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`ready_for_pickup\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`ready_for_pickup_at\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`ready_for_pickup_email_sent_at\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`pickup_instructions_snapshot\`;`)
  await db.run(sql`ALTER TABLE \`transactions\` DROP COLUMN \`fulfillment_method\`;`)
  await db.run(sql`ALTER TABLE \`transactions\` DROP COLUMN \`pickup_contact_first_name\`;`)
  await db.run(sql`ALTER TABLE \`transactions\` DROP COLUMN \`pickup_contact_last_name\`;`)
  await db.run(sql`ALTER TABLE \`transactions\` DROP COLUMN \`pickup_contact_phone\`;`)
}
