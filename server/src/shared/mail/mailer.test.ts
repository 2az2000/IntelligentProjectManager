import { describe, expect, it } from 'vitest';
import { createMailer } from './mailer';

const message = { to: 'sara@example.com', subject: 'Hi', text: 'Body' };

describe('createMailer', () => {
  it('uses the logged json transport when no SMTP URL is configured', async () => {
    const mailer = createMailer({ enabled: true, from: 'Test <t@example.com>', smtpUrl: undefined });
    expect(mailer.mode).toBe('json');
    expect(mailer.from).toBe('Test <t@example.com>');
    await expect(mailer.send(message)).resolves.toBe(true);
  });

  it('reports smtp mode as soon as a URL is set', () => {
    const mailer = createMailer({ enabled: true, smtpUrl: 'smtp://user:pass@localhost:2525' });
    expect(mailer.mode).toBe('smtp');
  });

  it('sends nothing when delivery is disabled', async () => {
    const mailer = createMailer({ enabled: false, smtpUrl: 'smtp://user:pass@localhost:2525' });
    expect(mailer.mode).toBe('off');
    await expect(mailer.send(message)).resolves.toBe(false);
  });
});
