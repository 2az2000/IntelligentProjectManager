import { ConflictError, NotFoundError } from '../../shared/errors';
import type { UsersRepository } from './users.repository';
import type { User, UserProfileChanges, UserSearchResult } from './users.types';

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

const SEARCH_LIMIT = 10;

export class UsersService {
  constructor(private readonly users: UsersRepository) {}

  async getById(id: number): Promise<User> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError('USER_NOT_FOUND', 'User not found');
    return user;
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findByEmail(normalizeEmail(email));
  }

  exists(id: number): Promise<boolean> {
    return this.users.exists(id);
  }

  async create(data: { email: string; name: string; passwordHash: string }): Promise<User> {
    const email = normalizeEmail(data.email);
    if (await this.users.findByEmail(email)) {
      throw new ConflictError('EMAIL_TAKEN', 'An account with this email already exists');
    }
    return this.users.create({ ...data, email, name: data.name.trim() });
  }

  async updateProfile(id: number, changes: UserProfileChanges): Promise<User> {
    await this.getById(id);
    return this.users.update(id, { ...changes, name: changes.name?.trim() });
  }

  async setPassword(id: number, passwordHash: string): Promise<void> {
    await this.users.setPassword(id, passwordHash);
  }

  search(query: string): Promise<UserSearchResult[]> {
    return this.users.search(query.trim(), SEARCH_LIMIT);
  }
}
