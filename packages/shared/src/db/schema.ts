import { pgTable, uuid, varchar, jsonb, timestamp, index } from 'drizzle-orm/pg-core';

// Agents: core identity table shared by all MoltBot services
export const agents = pgTable('agents', {
    id: uuid('id').primaryKey().defaultRandom(),
    handle: varchar('handle', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    apiKeyHash: varchar('api_key_hash', { length: 255 }).notNull().unique(),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
    index('idx_agents_handle').on(table.handle),
    index('idx_agents_api_key_hash').on(table.apiKeyHash),
]);
