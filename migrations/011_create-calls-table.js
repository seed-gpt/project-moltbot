/** @type {import('node-pg-migrate').ColumnDefinitions} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.createTable('calls', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    agent_id: {
      type: 'uuid',
      references: 'agents(id)',
      onDelete: 'CASCADE'
    },
    direction: {
      type: 'varchar(10)',
      notNull: true,
      check: "direction IN ('inbound', 'outbound')"
    },
    to_number: { type: 'varchar(20)', notNull: true },
    from_number: { type: 'varchar(20)', notNull: true },
    status: {
      type: 'varchar(20)',
      notNull: true,
      check: "status IN ('queued', 'ringing', 'in_progress', 'completed', 'failed', 'cancelled')"
    },
    duration_seconds: { type: 'integer', default: 0 },
    vapi_call_id: { type: 'varchar(100)' },
    cost_cents: { type: 'integer', default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    ended_at: { type: 'timestamptz' }
  });

  pgm.createIndex('calls', 'agent_id');
  pgm.createIndex('calls', 'vapi_call_id');
  pgm.createIndex('calls', 'status');
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable('calls');
};
