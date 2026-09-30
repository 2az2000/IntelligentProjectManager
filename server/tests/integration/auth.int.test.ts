import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { prisma, resetDb } from '../helpers/db';
import { TEST_PASSWORD, createUser } from '../helpers/factories';

const app = createApp({ db: prisma });

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

function cookieValue(res: request.Response, name: string): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((c) => c.startsWith(`${name}=`));
  return cookie?.split(';')[0]?.slice(name.length + 1);
}

describe('auth', () => {
  it('registers, sets httpOnly cookies and returns the user without password hash', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: ' New@Test.dev ', password: 'Password123!', name: 'New User' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: 'new@test.dev', name: 'New User' });
    expect(res.body).not.toHaveProperty('passwordHash');

    const cookies = (res.headers['set-cookie'] as unknown as string[]).join('\n');
    expect(cookies).toMatch(/access_token=.+HttpOnly/);
    expect(cookies).toMatch(/refresh_token=.+Path=\/auth.+HttpOnly/);
  });

  it('rejects duplicate emails and weak passwords', async () => {
    await createUser({ email: 'taken@test.dev' });
    const dup = await request(app)
      .post('/auth/register')
      .send({ email: 'taken@test.dev', password: 'Password123!', name: 'x' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('EMAIL_TAKEN');

    const weak = await request(app)
      .post('/auth/register')
      .send({ email: 'a@test.dev', password: 'short', name: 'x' });
    expect(weak.status).toBe(400);
  });

  it('logs in and serves /auth/me; wrong password gets a generic error', async () => {
    const user = await createUser({ email: 'me@test.dev' });
    const bad = await request(app)
      .post('/auth/login')
      .send({ email: 'me@test.dev', password: 'wrong-password' });
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('INVALID_CREDENTIALS');

    const unknown = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@test.dev', password: 'whatever' });
    expect(unknown.body.error.code).toBe('INVALID_CREDENTIALS');

    const agent = request.agent(app);
    expect((await agent.post('/auth/login').send({ email: 'ME@test.dev', password: TEST_PASSWORD })).status).toBe(200);
    const me = await agent.get('/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.id).toBe(user.id);
  });

  it('distinguishes expired from invalid access tokens', async () => {
    const res = await request(app).get('/auth/me').set('Authorization', 'Bearer garbage');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('rotates refresh tokens and revokes the family when an old token is reused', async () => {
    const user = await createUser();
    const login = await request(app).post('/auth/login').send({ email: user.email, password: TEST_PASSWORD });
    const first = cookieValue(login, 'refresh_token')!;

    const rotated = await request(app).post('/auth/refresh').set('Cookie', `refresh_token=${first}`);
    expect(rotated.status).toBe(204);
    const second = cookieValue(rotated, 'refresh_token')!;
    expect(second).not.toBe(first);

    // Simulate a stolen old token used after the grace window.
    await prisma.refreshToken.updateMany({
      where: { revokedAt: { not: null } },
      data: { revokedAt: new Date(Date.now() - 60_000) },
    });
    const reuse = await request(app).post('/auth/refresh').set('Cookie', `refresh_token=${first}`);
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe('REFRESH_TOKEN_REUSED');

    // The legitimate newer token is now revoked too.
    const after = await request(app).post('/auth/refresh').set('Cookie', `refresh_token=${second}`);
    expect(after.status).toBe(401);
  });

  it('logout revokes the session', async () => {
    const user = await createUser();
    const login = await request(app).post('/auth/login').send({ email: user.email, password: TEST_PASSWORD });
    const refresh = cookieValue(login, 'refresh_token')!;

    const out = await request(app).post('/auth/logout').set('Cookie', `refresh_token=${refresh}`);
    expect(out.status).toBe(204);
    const again = await request(app).post('/auth/refresh').set('Cookie', `refresh_token=${refresh}`);
    expect(again.status).toBe(401);
  });
});
