/** @type {import('node-pg-migrate').ColumnDefinitions} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.createTable('email_addresses', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    agent_id: {
      type: 'uuid',
      notNull: true,
      references: 'agents(id)',
      onDelete: 'CASCADE'
    },
    address: { type: 'varchar(255)', notNull: true, unique: true },
    verified: { type: 'boolean', notNull: true, default: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('email_addresses', 'agent_id');
  pgm.createIndex('email_addresses', 'address');
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable('email_addresses');
};
