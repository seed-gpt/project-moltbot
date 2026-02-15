/** @type {import('node-pg-migrate').ColumnDefinitions} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.createTable('credit_transactions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    credit_line_id: {
      type: 'uuid',
      notNull: true,
      references: 'credit_lines',
      onDelete: 'CASCADE',
    },
    amount: { type: 'integer', notNull: true },
    type: {
      type: 'varchar(10)',
      notNull: true,
      check: "type IN ('draw', 'repay')"
    },
    memo: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  // Index for efficient queries
  pgm.createIndex('credit_transactions', 'credit_line_id');
  pgm.createIndex('credit_transactions', 'created_at');
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable('credit_transactions');
};
