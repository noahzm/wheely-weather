import { describe, expect, it } from 'vitest';
import { GEAR_LABELS, GEAR_MODES } from '@/types/settings';

describe('GearStylePicker configuration', () => {
  it('pairs gear labels with correct gear modes', () => {
    expect(GEAR_MODES).toEqual(['casual', 'pro']);
    expect(GEAR_LABELS).toEqual(['Casual', 'Roadie']);
    expect(GEAR_MODES).toHaveLength(GEAR_LABELS.length);
  });
});
