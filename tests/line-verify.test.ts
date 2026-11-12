import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { safePicture } from '../lib/line-verify';

describe('safePicture', () => {
  it('accepts https line-scdn urls', () => {
    expect(safePicture('https://profile.line-scdn.net/abc')).toBe('https://profile.line-scdn.net/abc');
  });
  it('rejects other hosts, http, and junk', () => {
    expect(safePicture('https://evil.example.com/a.png')).toBeNull();
    expect(safePicture('http://profile.line-scdn.net/abc')).toBeNull();
    expect(safePicture('https://line-scdn.net.evil.com/a')).toBeNull();
    expect(safePicture(undefined)).toBeNull();
    expect(safePicture('not a url')).toBeNull();
  });
});
