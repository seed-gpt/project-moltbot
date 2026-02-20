import { pgTable, uuid, varchar, integer, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { agents } from '@moltbot/shared';

// Re-export agents for convenience
export { agents } from '@moltbot/shared';

// Phone calls
export const calls = pgTable('calls', {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'cascade' }),
    direction: varchar('direction', { length: 10 }).notNull(),
    toNumber: varchar('to_number', { length: 20 }).notNull(),
    fromNumber: varchar('from_number', { length: 20 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    durationSeconds: integer('duration_seconds').default(0),
    vapiCallId: varchar('vapi_call_id', { length: 100 }),
    costCents: integer('cost_cents').default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true, mode: 'date' }),
}, (table) => [
    index('idx_calls_agent_id').on(table.agentId),
    index('idx_calls_vapi_call_id').on(table.vapiCallId),
    index('idx_calls_status').on(table.status),
]);

// Call transcripts
export const transcripts = pgTable('transcripts', {
    id: uuid('id').primaryKey().defaultRandom(),
    callId: uuid('call_id').notNull().references(() => calls.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 10 }).notNull(),
    content: text('content').notNull(),
    timestampMs: integer('timestamp_ms').notNull(),
}, (table) => [
    index('idx_transcripts_call_id').on(table.callId),
]);

// Call webhooks
export const callWebhooks = pgTable('call_webhooks', {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
    url: varchar('url', { length: 500 }).notNull(),
    events: text('events').array().default([]),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
    index('idx_call_webhooks_agent_id').on(table.agentId),
]);
