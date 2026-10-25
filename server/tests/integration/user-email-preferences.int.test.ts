import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { prisma, resetDb } from '../helpers/db';
import { createUser, loginAs } from '../helpers/factories';

const app = createApp({ db: prisma });

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

/**
 * §2.1 — the account-wide `notifyEmail` switch is the master gate; these three decide which mails
 * still go out. The API must always return all three resolved, and a partial PATCH must never
 * reset the kinds it did not mention.
 */
describe('per-kind email preferences', () => {
  it('returns every kind resolved and on by default', async () => {
    const user = await createUser();
    const agent = await loginAs(app, user.email);

    const me = await agent.get('/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.emailPreferences).toEqual({ digest: true, reminders: true, weekly: true });
    expect(me.body.notifyEmail).toBe(true);
  });

  it('merges a partial update instead of replacing the object', async () => {
    const user = await createUser();
    const agent = await loginAs(app, user.email);

    const first = await agent.patch('/users/me').send({ emailPreferences: { digest: false } });
    expect(first.status).toBe(200);
    expect(first.body.emailPreferences).toEqual({ digest: false, reminders: true, weekly: true });

    const second = await agent.patch('/users/me').send({ emailPreferences: { weekly: false } });
    expect(second.body.emailPreferences).toEqual({ digest: false, reminders: true, weekly: false });

    // Survives a reload, not just the mutation response.
    const me = await agent.get('/auth/me');
    expect(me.body.emailPreferences).toEqual({ digest: false, reminders: true, weekly: false });
  });

  it('keeps the master switch independent from the per-kind switches', async () => {
    const user = await createUser();
    const agent = await loginAs(app, user.email);

    await agent.patch('/users/me').send({ emailPreferences: { reminders: false } });
    const off = await agent.patch('/users/me').send({ notifyEmail: false });
    expect(off.body.notifyEmail).toBe(false);
    // Turning mail off must not silently rewrite which kinds were chosen.
    expect(off.body.emailPreferences).toEqual({ digest: true, reminders: false, weekly: true });

    const backOn = await agent.patch('/users/me').send({ notifyEmail: true });
    expect(backOn.body.emailPreferences).toEqual({ digest: true, reminders: false, weekly: true });
  });

  it('rejects unknown kinds and non-boolean values', async () => {
    const user = await createUser();
    const agent = await loginAs(app, user.email);

    const unknown = await agent.patch('/users/me').send({ emailPreferences: { monthly: true } });
    expect(unknown.status).toBe(400);

    const wrongType = await agent.patch('/users/me').send({ emailPreferences: { digest: 'yes' } });
    expect(wrongType.status).toBe(400);

    // Nothing was written by the rejected requests.
    const me = await agent.get('/auth/me');
    expect(me.body.emailPreferences).toEqual({ digest: true, reminders: true, weekly: true });
  });

  it('only changes the caller’s own record', async () => {
    const [me, colleague] = await Promise.all([createUser(), createUser()]);
    const myAgent = await loginAs(app, me.email);

    await myAgent.patch('/users/me').send({ emailPreferences: { digest: false } });

    const other = await prisma.user.findUniqueOrThrow({ where: { id: colleague.id } });
    expect(other.emailPreferences).toBeNull();
  });

  it('does not require a role or project membership', async () => {
    // A brand-new account with no projects must still be able to choose its mail.
    const user = await createUser();
    const agent = await loginAs(app, user.email);
    const res = await agent.patch('/users/me').send({ emailPreferences: { digest: false } });
    expect(res.status).toBe(200);
  });
});
