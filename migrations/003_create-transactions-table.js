/** @type {import('node-pg-migrate').ColumnDefinitions} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.createTable('transactions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    from_agent_id: {
      type: 'uuid',
      references: 'agents',
      onDelete: 'SET NULL',
    },
    to_agent_id: {
      type: 'uuid',
      references: 'agents',
      onDelete: 'SET NULL',
    },
    amount: { type: 'integer', notNull: true },
    type: {
      type: 'varchar(50)',
      notNull: true,
      check: "type IN ('deposit', 'transfer', 'escrow_lock', 'escrow_release')",
    },
    memo: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('transactions', 'from_agent_id');
  pgm.createIndex('transactions', 'to_agent_id');
  pgm.createIndex('transactions', 'created_at');
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable('transactions');
};
