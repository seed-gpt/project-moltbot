/** @type {import('node-pg-migrate').ColumnDefinitions} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.createTable('wallets', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    agent_id: {
      type: 'uuid',
      notNull: true,
      unique: true,
      references: 'agents',
      onDelete: 'CASCADE',
    },
    balance: { type: 'integer', notNull: true, default: 0 },
    currency: { type: 'varchar(10)', notNull: true, default: 'USDC' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('wallets', 'agent_id');
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable('wallets');
};
