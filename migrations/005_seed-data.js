/** @type {import('node-pg-migrate').ColumnDefinitions} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  // Insert test agents with hardcoded API key hashes (for dev only)
  pgm.sql(`
    INSERT INTO agents (handle, name, api_key_hash, metadata) VALUES
    ('alpha-agent', 'Alpha Agent', 'alpha_hash_dev_001', '{"environment": "development"}'),
    ('beta-agent', 'Beta Agent', 'beta_hash_dev_002', '{"environment": "development"}'),
    ('gamma-agent', 'Gamma Agent', 'gamma_hash_dev_003', '{"environment": "development"}')
  `);

  // Create wallets for each agent with 10000 cents (100.00 USDC)
  pgm.sql(`
    INSERT INTO wallets (agent_id, balance, currency)
    SELECT id, 10000, 'USDC'
    FROM agents
    WHERE handle IN ('alpha-agent', 'beta-agent', 'gamma-agent')
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  // Delete wallets first (due to foreign key constraints)
  pgm.sql(`
    DELETE FROM wallets
    WHERE agent_id IN (
      SELECT id FROM agents
      WHERE handle IN ('alpha-agent', 'beta-agent', 'gamma-agent')
    )
  `);

  // Delete test agents
  pgm.sql(`
    DELETE FROM agents
    WHERE handle IN ('alpha-agent', 'beta-agent', 'gamma-agent')
  `);
};
