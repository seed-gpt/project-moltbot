/** @type {import('node-pg-migrate').ColumnDefinitions} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.createTable('emails', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    from_address: { type: 'varchar(255)', notNull: true },
    to_address: { type: 'varchar(255)', notNull: true },
    subject: { type: 'varchar(500)' },
    body_text: { type: 'text' },
    body_html: { type: 'text' },
    status: {
      type: 'varchar(20)',
      notNull: true,
      check: "status IN ('queued', 'sent', 'delivered', 'failed', 'received')"
    },
    direction: {
      type: 'varchar(10)',
      notNull: true,
      check: "direction IN ('inbound', 'outbound')"
    },
    message_id: { type: 'varchar(255)' },
    agent_id: {
      type: 'uuid',
      references: 'agents(id)',
      onDelete: 'CASCADE'
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('emails', 'from_address');
  pgm.createIndex('emails', 'to_address');
  pgm.createIndex('emails', 'agent_id');
  pgm.createIndex('emails', 'message_id');
  pgm.createIndex('emails', ['agent_id', 'direction', 'created_at']);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable('emails');
};
