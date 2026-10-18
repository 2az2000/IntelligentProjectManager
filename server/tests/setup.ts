import os from 'node:os';
import path from 'node:path';
import { testDatabaseUrl } from './test-db-url';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = testDatabaseUrl();
// Uploaded files (attachments, avatars) never touch the repo during tests.
process.env.UPLOAD_DIR = path.join(os.tmpdir(), 'managesys-test-uploads');
