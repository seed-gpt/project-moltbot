import { pgTable, uuid, varchar, integer, text, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { agents } from '@moltbot/shared';

// Re-export agents for convenience
export { agents } from '@moltbot/shared';

// Credit lines between agents
export const creditLines = pgTable('credit_lines', {
    id: uuid('id').primaryKey().defaultRandom(),
    grantorId: uuid('grantor_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
    granteeId: uuid('grantee_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
    limitAmount: integer('limit_amount').notNull(),
    usedAmount: integer('used_amount').notNull().default(0),
    currency: varchar('currency', { length: 10 }).notNull().default('USDC'),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
    unique('unique_grantor_grantee').on(table.grantorId, table.granteeId),
    index('idx_credit_lines_grantor_id').on(table.grantorId),
    index('idx_credit_lines_grantee_id').on(table.granteeId),
    index('idx_credit_lines_status').on(table.status),
]);

// Credit transactions (draws and repayments)
export const creditTransactions = pgTable('credit_transactions', {
    id: uuid('id').primaryKey().defaultRandom(),
    creditLineId: uuid('credit_line_id').notNull().references(() => creditLines.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(),
    type: varchar('type', { length: 10 }).notNull(),
    memo: text('memo'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
    index('idx_credit_transactions_credit_line_id').on(table.creditLineId),
    index('idx_credit_transactions_created_at').on(table.createdAt),
]);
