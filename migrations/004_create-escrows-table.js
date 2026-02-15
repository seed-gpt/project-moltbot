/** @type {import('node-pg-migrate').ColumnDefinitions} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.createTable('escrows', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    creator_id: {
      type: 'uuid',
      notNull: true,
      references: 'agents',
      onDelete: 'CASCADE',
    },
    counterparty_id: {
      type: 'uuid',
      notNull: true,
      references: 'agents',
      onDelete: 'CASCADE',
    },
    amount: { type: 'integer', notNull: true },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'active',
      check: "status IN ('active', 'released', 'disputed', 'cancelled')",
    },
    description: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('escrows', 'creator_id');
  pgm.createIndex('escrows', 'counterparty_id');
  pgm.createIndex('escrows', 'status');
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable('escrows');
};
