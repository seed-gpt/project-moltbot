/** @type {import('node-pg-migrate').ColumnDefinitions} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.createTable('credit_lines', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    grantor_id: {
      type: 'uuid',
      notNull: true,
      references: 'agents',
      onDelete: 'CASCADE',
    },
    grantee_id: {
      type: 'uuid',
      notNull: true,
      references: 'agents',
      onDelete: 'CASCADE',
    },
    limit_amount: { type: 'integer', notNull: true },
    used_amount: { type: 'integer', notNull: true, default: 0 },
    currency: { type: 'varchar(10)', notNull: true, default: 'USDC' },
    status: { type: 'varchar(20)', notNull: true, default: 'active' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  // Unique constraint: each grantor can only have one credit line to each grantee
  pgm.addConstraint('credit_lines', 'unique_grantor_grantee', {
    unique: ['grantor_id', 'grantee_id'],
  });

  // Indexes for efficient queries
  pgm.createIndex('credit_lines', 'grantor_id');
  pgm.createIndex('credit_lines', 'grantee_id');
  pgm.createIndex('credit_lines', 'status');
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable('credit_lines');
};
