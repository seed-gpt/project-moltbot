import { generateApiKey, hashApiKey } from './auth.js';

describe('auth', () => {
  describe('generateApiKey', () => {
    it('generates key with moltbank prefix', () => {
      const key = generateApiKey('moltbank');
      expect(key).toMatch(/^mb_[a-f0-9]{64}$/);
    });

    it('generates key with moltcredit prefix', () => {
      const key = generateApiKey('moltcredit');
      expect(key).toMatch(/^mc_[a-f0-9]{64}$/);
    });

    it('generates unique keys', () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe('hashApiKey', () => {
    it('produces consistent hash', () => {
      process.env.API_KEY_SALT = 'test-salt';
      const key = 'mb_abc123';
      expect(hashApiKey(key)).toBe(hashApiKey(key));
    });

    it('different keys produce different hashes', () => {
      process.env.API_KEY_SALT = 'test-salt';
      expect(hashApiKey('mb_key1')).not.toBe(hashApiKey('mb_key2'));
    });
  });
});
