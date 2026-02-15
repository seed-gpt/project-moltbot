/** @type {import('node-pg-migrate').ColumnDefinitions} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.createTable('agents', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    handle: { type: 'varchar(50)', notNull: true, unique: true },
    name: { type: 'varchar(255)', notNull: true },
    api_key_hash: { type: 'varchar(255)', notNull: true, unique: true },
    metadata: { type: 'jsonb', default: '{}' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('agents', 'handle');
  pgm.createIndex('agents', 'api_key_hash');
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable('agents');
};
