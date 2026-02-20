import { pgTable, uuid, varchar, integer, text, timestamp, index } from 'drizzle-orm/pg-core';
import { agents } from '@moltbot/shared';

// Re-export agents for convenience
export { agents } from '@moltbot/shared';

// Wallets: one per agent
export const wallets = pgTable('wallets', {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: uuid('agent_id').notNull().unique().references(() => agents.id, { onDelete: 'cascade' }),
    balance: integer('balance').notNull().default(0),
    currency: varchar('currency', { length: 10 }).notNull().default('USDC'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
    index('idx_wallets_agent_id').on(table.agentId),
]);

// Transactions: transfers between agents
export const transactions = pgTable('transactions', {
    id: uuid('id').primaryKey().defaultRandom(),
    fromAgentId: uuid('from_agent_id').references(() => agents.id, { onDelete: 'set null' }),
    toAgentId: uuid('to_agent_id').references(() => agents.id, { onDelete: 'set null' }),
    amount: integer('amount').notNull(),
    type: varchar('type', { length: 50 }).notNull(),
    memo: text('memo'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
    index('idx_transactions_from_agent_id').on(table.fromAgentId),
    index('idx_transactions_to_agent_id').on(table.toAgentId),
    index('idx_transactions_created_at').on(table.createdAt),
]);

// Escrows: locked funds between two agents
export const escrows = pgTable('escrows', {
    id: uuid('id').primaryKey().defaultRandom(),
    creatorId: uuid('creator_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
    counterpartyId: uuid('counterparty_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
    index('idx_escrows_creator_id').on(table.creatorId),
    index('idx_escrows_counterparty_id').on(table.counterpartyId),
    index('idx_escrows_status').on(table.status),
]);
