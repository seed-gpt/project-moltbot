/** @type {import('node-pg-migrate').ColumnDefinitions} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.createTable('call_webhooks', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    agent_id: {
      type: 'uuid',
      notNull: true,
      references: 'agents(id)',
      onDelete: 'CASCADE'
    },
    url: { type: 'varchar(500)', notNull: true },
    events: { type: 'text[]', default: pgm.func("'{}'") },
    active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') }
  });

  pgm.createIndex('call_webhooks', 'agent_id');
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable('call_webhooks');
};
