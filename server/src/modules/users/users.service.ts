import { randomUUID } from 'node:crypto';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors';
import type { UsersRepository } from './users.repository';
import type { User, UserProfileChanges, UserSearchResult } from './users.types';

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

const SEARCH_LIMIT = 10;

/** Uploaded profile photos: small images only, stored on disk and served from /avatars. */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_PREFIX = '/avatars/';
const AVATAR_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
/** Files are named by the server (uuid + extension); never trust a client-supplied name. */
const AVATAR_FILE_NAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|gif)$/;

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
    const current = await this.getById(id);
    const user = await this.users.update(id, { ...changes, name: changes.name?.trim() });
    // Clearing or replacing the photo must not leave the old upload behind on disk.
    if (changes.avatarUrl !== undefined && changes.avatarUrl !== current.avatarUrl) {
      await this.removeAvatarFile(current.avatarUrl);
    }
    return user;
  }

  async setPassword(id: number, passwordHash: string): Promise<void> {
    await this.users.setPassword(id, passwordHash);
  }

  private readonly avatarDir = path.resolve(env.UPLOAD_DIR, 'avatars');

  /**
   * Stores an uploaded profile photo and points `avatarUrl` at the public /avatars route.
   * The previous upload (if any) is deleted; external URLs are left untouched.
   */
  async updateAvatar(id: number, file: Express.Multer.File): Promise<User> {
    const current = await this.getById(id);
    const extension = AVATAR_EXTENSIONS[file.mimetype];
    if (!extension)
      throw new ValidationError(null, 'Only PNG, JPEG, WebP or GIF images are supported');
    if (file.size === 0) throw new ValidationError(null, 'Empty files are not allowed');
    if (file.size > AVATAR_MAX_BYTES) {
      throw new ValidationError(
        null,
        `Image exceeds the ${AVATAR_MAX_BYTES / 1024 / 1024} MB limit`,
      );
    }

    const fileName = `${randomUUID()}.${extension}`;
    await mkdir(this.avatarDir, { recursive: true });
    await writeFile(path.join(this.avatarDir, fileName), file.buffer);

    const user = await this.users.update(id, { avatarUrl: `${AVATAR_PREFIX}${fileName}` });
    await this.removeAvatarFile(current.avatarUrl);
    return user;
  }

  /** Location + size of a stored avatar, or null when the name is unknown or the file is gone. */
  async avatarPath(fileName: string): Promise<{ absolute: string; size: number } | null> {
    if (!AVATAR_FILE_NAME.test(fileName)) return null;
    const absolute = path.join(this.avatarDir, fileName);
    try {
      const stats = await stat(absolute);
      return { absolute, size: stats.size };
    } catch {
      return null;
    }
  }

  private async removeAvatarFile(avatarUrl: string | null): Promise<void> {
    const fileName = avatarUrl?.startsWith(AVATAR_PREFIX)
      ? avatarUrl.slice(AVATAR_PREFIX.length)
      : '';
    if (!AVATAR_FILE_NAME.test(fileName)) return;
    await unlink(path.join(this.avatarDir, fileName)).catch(() => undefined);
  }

  search(query: string): Promise<UserSearchResult[]> {
    return this.users.search(query.trim(), SEARCH_LIMIT);
  }
}
