import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { prisma } from '../helpers/db';

// Phase 6: security stack (helmet headers, CSRF origin guard) + the /docs contract.
const app = createApp({ db: prisma });
afterAll(() => prisma.$disconnect());

const ALLOWED_ORIGIN = 'http://localhost:3000'; // first entry of the default CORS_ORIGIN

describe('security headers (helmet)', () => {
  it('hardens every response', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['strict-transport-security']).toContain('max-age');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
  });
});

describe('CSRF origin guard', () => {
  it('blocks state-changing requests from unknown origins', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ email: 'nobody@test.dev', password: 'whatever-1!' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_ORIGIN_MISMATCH');
  });

  it('blocks via Referer when Origin is absent', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('Referer', 'https://evil.example/login')
      .send({ email: 'nobody@test.dev', password: 'whatever-1!' });
    expect(res.status).toBe(403);
  });

  it('lets allowed origins through to normal auth errors', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('Origin', ALLOWED_ORIGIN)
      .send({ email: 'nobody@test.dev', password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).not.toBe('CSRF_ORIGIN_MISMATCH');
  });

  it('never blocks non-browser clients (no Origin header)', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@test.dev', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('does not guard safe methods (reads rely on CORS)', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Origin', 'https://evil.example');
    expect(res.status).toBe(401); // unauthenticated, not origin-blocked
  });
});

describe('OpenAPI docs', () => {
  it('serves a Swagger UI page and a valid document outside production', async () => {
    const page = await request(app).get('/docs/');
    expect(page.status).toBe(200);
    expect(page.text).toContain('swagger-ui');

    const doc = await request(app).get('/docs.json');
    expect(doc.status).toBe(200);
    expect(doc.body.openapi).toBe('3.0.3');
    expect(Object.keys(doc.body.paths).length).toBeGreaterThanOrEqual(25);
    expect(doc.body.components.securitySchemes.cookieAuth.name).toBe('access_token');
    // Request schemas come from the very same Zod objects the API validates with.
    expect(JSON.stringify(doc.body.paths['/auth/login'])).toContain('password');
  });

  it('documents cookie auth and the uniform error envelope', async () => {
    const doc = await request(app).get('/docs.json');
    const login = doc.body.paths['/auth/login'].post;
    expect(login.tags).toEqual(['Auth']);
    const taskDelete = doc.body.paths['/tasks/{taskId}'].delete;
    expect(taskDelete.security).toEqual([{ cookieAuth: [] }]);
  });
});
