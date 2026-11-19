import { describe, expect, it } from 'vitest';
import { parseSyncCode } from '../src/lib/store';

describe('parseSyncCode', () => {
  it('accepts a plain code, a token, or a QR link', () => {
    expect(parseSyncCode(' ghp_abc:123 ')).toBe('ghp_abc:123');
    expect(parseSyncCode('ghp_abc')).toBe('ghp_abc');
    expect(parseSyncCode('https://dr12500.github.io/chess/#sync=ghp_abc%3A123')).toBe('ghp_abc:123');
    expect(parseSyncCode('#sync=ghp_abc:123')).toBe('ghp_abc:123');
  });
});
