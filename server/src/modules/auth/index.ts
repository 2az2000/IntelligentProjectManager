import type { Db } from '../../shared/db/prisma';
import type { UsersService } from '../users';
import { AuthService } from './auth.service';
import { RefreshTokenRepository } from './refresh-token.repository';
import { createAuthRouter } from './auth.routes';

export function createAuthModule(deps: { db: Db; users: UsersService }) {
  const service = new AuthService(deps.users, new RefreshTokenRepository(deps.db));
  return { service, router: createAuthRouter(service, deps.users) };
}

export { hashPassword } from './password';
export { loginBody, registerBody, changePasswordBody } from './auth.schemas';
