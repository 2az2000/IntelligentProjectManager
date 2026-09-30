import type { Db } from '../../shared/db/prisma';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';
import { createUsersRouter } from './users.routes';

export function createUsersModule(deps: { db: Db }) {
  const service = new UsersService(new UsersRepository(deps.db));
  return { service, router: createUsersRouter(service) };
}

export type { UsersService } from './users.service';
export { normalizeEmail } from './users.service';
export { toUserDto } from './users.types';
export type { User, UserDto, UserSummaryDto } from './users.types';
