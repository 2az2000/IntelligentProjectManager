-- §2.1: which mails are delivered when the account-wide `notifyEmail` switch is on.
-- NULL means "all kinds on", so existing rows keep today's behaviour without a backfill.
ALTER TABLE "User" ADD COLUMN "emailPreferences" JSONB;
