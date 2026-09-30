import type { Db } from '../../shared/db/prisma';
import type { User, UserProfileChanges, UserSearchResult } from './users.types';

export class UsersRepository {
  constructor(private readonly db: Db) {}

  findById(id: number): Promise<User | null> {
    return this.db.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { email } });
  }

  async exists(id: number): Promise<boolean> {
    return (await this.db.user.count({ where: { id } })) > 0;
  }

  create(data: { email: string; name: string; passwordHash: string }): Promise<User> {
    return this.db.user.create({ data });
  }

  update(id: number, data: UserProfileChanges): Promise<User> {
    return this.db.user.update({ where: { id }, data });
  }

  async setPassword(id: number, passwordHash: string): Promise<void> {
    await this.db.user.update({ where: { id }, data: { passwordHash } });
  }

  search(query: string, limit: number): Promise<UserSearchResult[]> {
    return this.db.user.findMany({
      where: {
        OR: [
          { email: { startsWith: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, email: true, avatarUrl: true },
      orderBy: { name: 'asc' },
      take: limit,
    });
  }
}
