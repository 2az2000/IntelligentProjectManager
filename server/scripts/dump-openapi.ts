import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openapiDocument } from '../src/shared/openapi';

/**
 * Writes the same document `/docs.json` serves to the repo root.
 *
 * The client generates its API types from that file (`npm run gen:api`), so a
 * schema drifts into a TypeScript error instead of a runtime 400. CI re-runs
 * this and fails when the committed file is stale.
 */
const out = resolve(import.meta.dirname, '../../openapi.json');
writeFileSync(out, `${JSON.stringify(openapiDocument, null, 2)}\n`, 'utf8');
console.log(`wrote ${out}`);
