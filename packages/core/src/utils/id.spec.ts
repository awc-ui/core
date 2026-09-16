import { createId } from './id';

describe('createId', () => {
  const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

  function setCrypto(value: unknown) {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value });
  }

  afterEach(() => {
    if (originalCrypto) Object.defineProperty(globalThis, 'crypto', originalCrypto);
    else Reflect.deleteProperty(globalThis, 'crypto');
    jest.restoreAllMocks();
  });

  it('uses Web Crypto without requiring the secure-context-only randomUUID API', () => {
    let sequence = 0;
    const crypto = {
      getRandomValues: jest.fn(function (this: unknown, bytes: Uint8Array) {
        expect(this).toBe(crypto);
        expect(bytes.byteLength).toBe(16);
        return bytes.fill(++sequence);
      }),
    };
    setCrypto(crypto);
    jest.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Unexpected insecure randomness'); });

    const first = createId('md-field');
    const second = createId('md-field');

    expect(first).toMatch(/^md-field-[0-9a-f]{32}$/);
    expect(second).toMatch(/^md-field-[0-9a-f]{32}$/);
    expect(second).not.toBe(first);
    expect(crypto.getRandomValues).toHaveBeenCalledTimes(2);
  });

  it.each([undefined, {}])('keeps ids unique without Web Crypto (%p)', (crypto) => {
    setCrypto(crypto);
    jest.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Unexpected insecure randomness'); });

    const ids = Array.from({ length: 1000 }, () => createId('md-field'));

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^md-field-fallback-\d+$/.test(id))).toBe(true);
  });
});
