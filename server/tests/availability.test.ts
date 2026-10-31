import { describe, expect, it } from 'vitest';
import { deriveAvailability } from '../src/services/library/availability.js';

const NOW = new Date('2026-10-31T12:00:00Z');
const future = new Date('2027-01-01T00:00:00Z');
const past = new Date('2026-01-01T00:00:00Z');

describe('deriveAvailability — the playability truth table', () => {
  it('is UNAVAILABLE for metadata-only titles (the critical rule)', () => {
    expect(deriveAvailability([], [], NOW)).toBe('UNAVAILABLE');
  });

  it('is AVAILABLE only with an active, unexpired source', () => {
    expect(deriveAvailability([{ status: 'ACTIVE', expiresAt: null }], [], NOW)).toBe('AVAILABLE');
    expect(deriveAvailability([{ status: 'ACTIVE', expiresAt: future }], [], NOW)).toBe('AVAILABLE');
  });

  it('reports EXPIRED when the only source lapsed', () => {
    expect(deriveAvailability([{ status: 'ACTIVE', expiresAt: past }], [], NOW)).toBe('EXPIRED');
    expect(deriveAvailability([{ status: 'EXPIRED', expiresAt: past }], [], NOW)).toBe('EXPIRED');
  });

  it('prefers AVAILABLE over EXPIRED when a second source is still valid', () => {
    expect(
      deriveAvailability(
        [
          { status: 'EXPIRED', expiresAt: past },
          { status: 'ACTIVE', expiresAt: future },
        ],
        [],
        NOW,
      ),
    ).toBe('AVAILABLE');
  });

  it('reports PROCESSING while an asset transcodes', () => {
    expect(
      deriveAvailability([{ status: 'INACTIVE', expiresAt: null }], [{ status: 'TRANSCODING' }], NOW),
    ).toBe('PROCESSING');
    expect(deriveAvailability([], [{ status: 'PENDING' }], NOW)).toBe('PROCESSING');
  });

  it('never derives availability from anything but sources/assets', () => {
    // no hidden inputs: same inputs always produce the same truth
    const sources = [{ status: 'ACTIVE', expiresAt: null }];
    expect(deriveAvailability(sources, [], NOW)).toBe('AVAILABLE');
    expect(deriveAvailability([], [], NOW)).toBe('UNAVAILABLE');
  });
});
