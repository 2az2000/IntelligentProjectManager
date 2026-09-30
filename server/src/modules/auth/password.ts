import bcrypt from 'bcryptjs';
import { isTest } from '../../config/env';

const COST = isTest ? 4 : 12;

// Compared against when the email is unknown, so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', COST);

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  // Legacy users migrated without a password have an empty hash and can never log in.
  const ok = await bcrypt.compare(password, hash || DUMMY_HASH);
  return ok && !!hash;
}
