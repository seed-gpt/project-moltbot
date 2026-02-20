import { pgTable, uuid, varchar, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { agents } from '@moltbot/shared';

// Re-export agents for convenience
export { agents } from '@moltbot/shared';

// Email addresses owned by agents
export const emailAddresses = pgTable('email_addresses', {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
    address: varchar('address', { length: 255 }).notNull().unique(),
    verified: boolean('verified').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
    index('idx_email_addresses_agent_id').on(table.agentId),
    index('idx_email_addresses_address').on(table.address),
]);

// Emails (inbound and outbound)
export const emails = pgTable('emails', {
    id: uuid('id').primaryKey().defaultRandom(),
    fromAddress: varchar('from_address', { length: 255 }).notNull(),
    toAddress: varchar('to_address', { length: 255 }).notNull(),
    subject: varchar('subject', { length: 500 }),
    bodyText: text('body_text'),
    bodyHtml: text('body_html'),
    status: varchar('status', { length: 20 }).notNull(),
    direction: varchar('direction', { length: 10 }).notNull(),
    messageId: varchar('message_id', { length: 255 }),
    agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
    index('idx_emails_from_address').on(table.fromAddress),
    index('idx_emails_to_address').on(table.toAddress),
    index('idx_emails_agent_id').on(table.agentId),
    index('idx_emails_message_id').on(table.messageId),
    index('idx_emails_agent_direction_created').on(table.agentId, table.direction, table.createdAt),
]);

// Email webhooks
export const emailWebhooks = pgTable('email_webhooks', {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
    url: varchar('url', { length: 500 }).notNull(),
    events: text('events').array().default([]),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
    index('idx_email_webhooks_agent_id').on(table.agentId),
    index('idx_email_webhooks_active').on(table.active),
]);
