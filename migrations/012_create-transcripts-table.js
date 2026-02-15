/** @type {import('node-pg-migrate').ColumnDefinitions} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.createTable('transcripts', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    call_id: {
      type: 'uuid',
      notNull: true,
      references: 'calls(id)',
      onDelete: 'CASCADE'
    },
    role: {
      type: 'varchar(10)',
      notNull: true,
      check: "role IN ('agent', 'user')"
    },
    content: { type: 'text', notNull: true },
    timestamp_ms: { type: 'integer', notNull: true }
  });

  pgm.createIndex('transcripts', 'call_id');
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable('transcripts');
};
