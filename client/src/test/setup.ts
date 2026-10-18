import { createRequire } from 'node:module';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './msw-server';

// jsdom lacks ResizeObserver, which Radix components (Select, Checkbox, Dialog) rely on.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!('ResizeObserver' in globalThis)) {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;
}

// vitest's jsdom↔undici bridge converts jsdom Blobs before handing them to Node's fetch.
// It locates the internal Blob impl through the first own symbol of a fresh `new Blob()`
// (see makeCompatBlob in vitest/dist): `blob[implSymbol]`. jsdom 30 no longer exposes that
// symbol, so the lookup resolves to the *string* "undefined", yields nothing, and every
// multipart request dies with "Failed to read a Blob as bytes". jsdom's idl layer still
// tracks wrapper→impl pairs, so re-expose the registry under the key the bridge actually
// reads. No-op on jsdom versions that still export the symbol.
const blobImplSymbol = Object.getOwnPropertySymbols(
  Object.getOwnPropertyDescriptors(new window.Blob()),
)[0] as symbol | undefined;

if (!blobImplSymbol) {
  const require = createRequire(import.meta.url);
  const { implForWrapper } = require('jsdom/lib/generated/idl/utils.js') as {
    implForWrapper: (wrapper: object) => unknown;
  };
  Object.defineProperty(window.Blob.prototype, 'undefined', {
    configurable: true,
    get(this: object) {
      return implForWrapper(this);
    },
  });
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
