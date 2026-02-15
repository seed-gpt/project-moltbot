import request from 'supertest';

/**
 * E2E Smoke Tests
 *
 * These tests verify the basic health and availability of all MoltBolt services.
 * They test the full agent lifecycle across multiple services:
 * 1. MoltBank - Agent registration and wallet management
 * 2. MoltCredit - Credit line creation
 * 3. MoltMail - Email sending
 * 4. MoltPhone - Phone call initiation
 *
 * Note: In unit test mode (without live DB), we only test health endpoints.
 * For full integration tests, run with DATABASE_URL set and services running.
 */

const MOLTBANK_URL = process.env.MOLTBANK_URL || 'http://localhost:3001';
const MOLTCREDIT_URL = process.env.MOLTCREDIT_URL || 'http://localhost:3002';
const MOLTMAIL_URL = process.env.MOLTMAIL_URL || 'http://localhost:3003';
const MOLTPHONE_URL = process.env.MOLTPHONE_URL || 'http://localhost:3004';

describe('MoltBank Service', () => {
  it('should respond to health check', async () => {
    const response = await request(MOLTBANK_URL)
      .get('/health')
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      service: 'moltbank',
    });
  });

  it('should have API documentation available', async () => {
    const response = await request(MOLTBANK_URL)
      .get('/docs/')
      .expect(301); // Swagger UI redirects

    expect(response.headers.location).toContain('/docs');
  });
});

describe('MoltCredit Service', () => {
  it('should respond to health check', async () => {
    const response = await request(MOLTCREDIT_URL)
      .get('/health')
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      service: 'moltcredit',
    });
  });

  it('should have API documentation available', async () => {
    const response = await request(MOLTCREDIT_URL)
      .get('/docs/')
      .expect(301); // Swagger UI redirects

    expect(response.headers.location).toContain('/docs');
  });
});

describe('MoltMail Service', () => {
  it('should respond to health check', async () => {
    const response = await request(MOLTMAIL_URL)
      .get('/health')
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      service: 'moltmail',
    });
  });

  it('should have API documentation available', async () => {
    const response = await request(MOLTMAIL_URL)
      .get('/docs/')
      .expect(301); // Swagger UI redirects

    expect(response.headers.location).toContain('/docs');
  });
});

describe('MoltPhone Service', () => {
  it('should respond to health check', async () => {
    const response = await request(MOLTPHONE_URL)
      .get('/health')
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      service: 'moltphone',
    });
  });

  it('should have API documentation available', async () => {
    const response = await request(MOLTPHONE_URL)
      .get('/docs/')
      .expect(301); // Swagger UI redirects

    expect(response.headers.location).toContain('/docs');
  });
});

describe('Full Agent Lifecycle (Integration)', () => {
  // Skip these tests in CI without live services
  const skipIntegration = !process.env.RUN_INTEGRATION_TESTS;

  it.skip('should complete full agent lifecycle', async () => {
    if (skipIntegration) {
      console.log('Skipping integration test - set RUN_INTEGRATION_TESTS=true to enable');
      return;
    }

    // 1. Register agent with MoltBank
    const registerResponse = await request(MOLTBANK_URL)
      .post('/register')
      .send({
        handle: 'test-agent-' + Date.now(),
        name: 'Test Agent',
        email: 'test@example.com',
      })
      .expect(201);

    const { api_key } = registerResponse.body;
    expect(api_key).toBeTruthy();

    // 2. Check wallet balance
    const walletResponse = await request(MOLTBANK_URL)
      .get('/wallet')
      .set('Authorization', `Bearer ${api_key}`)
      .expect(200);

    expect(walletResponse.body).toHaveProperty('balance');
    expect(walletResponse.body.balance).toBe('0.00');

    // 3. Create credit line with MoltCredit
    const creditResponse = await request(MOLTCREDIT_URL)
      .post('/credit-lines')
      .set('Authorization', `Bearer ${api_key}`)
      .send({
        amount: 1000,
        term_months: 12,
      })
      .expect(201);

    expect(creditResponse.body).toHaveProperty('id');
    expect(creditResponse.body.status).toBe('pending');

    // 4. Send email via MoltMail
    const emailResponse = await request(MOLTMAIL_URL)
      .post('/emails/send')
      .set('Authorization', `Bearer ${api_key}`)
      .send({
        to: 'recipient@example.com',
        subject: 'Test Email',
        body: 'This is a test email',
      })
      .expect(201);

    expect(emailResponse.body).toHaveProperty('email_id');
    expect(emailResponse.body.status).toBe('queued');

    // 5. Initiate call via MoltPhone
    const callResponse = await request(MOLTPHONE_URL)
      .post('/calls/initiate')
      .set('Authorization', `Bearer ${api_key}`)
      .send({
        to: '+15551234567',
        message: 'This is a test call',
      })
      .expect(201);

    expect(callResponse.body).toHaveProperty('call_id');
    expect(callResponse.body.status).toBe('initiated');
  });
});
