import { testDatabaseUrl } from './test-db-url';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = testDatabaseUrl();
