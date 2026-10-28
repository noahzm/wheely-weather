import { describe, expect, it, vi } from 'vitest';

const platform: {
  OS: string;
  Version: string | number;
  select: <T>(spec: { default?: T }) => T | undefined;
} = vi.hoisted(() => ({
  OS: 'ios',
  Version: '26.0',
  select: <T>(spec: { default?: T }) => spec.default,
}));

vi.mock('react-native', () => ({ Platform: platform }));

const { PosterLightText, PosterText, WheelyTheme } = await import('@/constants/theme');
const { largeTitleStackOptions, largeTitleStyle } = await import('./large-title-stack-options');

describe('largeTitleStackOptions', () => {
  it('omits headerBlurEffect on iOS 26+ where the system auto-applies header blur', () => {
    platform.OS = 'ios';
    platform.Version = '26.1';

    const opts = largeTitleStackOptions(WheelyTheme.light, 'Wheely');
    expect(opts.headerTransparent).toBe(true);
    expect(opts.headerBlurEffect).toBeUndefined();
    // Poster titles are capitals, set on the string: native titles can't transform text.
    expect(opts.headerTitle).toBe('WHEELY');
    expect(opts.headerTintColor).toBe(WheelyTheme.light.ink);
    // iOS needs '700' so RCTFont keeps Oswald-Bold in the shared "Oswald" family;
    // PosterLightText stays '400' for Oswald-Regular stats and burst chips.
    expect(PosterText.fontWeight).toBe('700');
    expect(PosterLightText.fontWeight).toBe('400');
    expect(opts.headerTitleStyle.fontWeight).toBe('700');
    expect(opts.headerLargeTitleStyle.fontWeight).toBe('700');
  });

  it('sets regular headerBlurEffect on iOS versions prior to 26', () => {
    platform.OS = 'ios';
    platform.Version = 18;

    const opts = largeTitleStackOptions(WheelyTheme.dark, 'Settings');
    expect(opts.headerTransparent).toBe(true);
    expect(opts.headerBlurEffect).toBe('regular');
  });

  it('disables headerTransparent and uses regular weight for aliased fonts on non-iOS platforms', () => {
    platform.OS = 'android';
    platform.Version = 35;

    const opts = largeTitleStackOptions(WheelyTheme.light, 'Search');
    expect(opts.headerTransparent).toBe(false);
    expect(opts.headerBlurEffect).toBe('regular');
    expect(opts.headerTitleStyle.fontWeight).toBe('400');
    expect(opts.headerLargeTitleStyle.fontWeight).toBe('400');
  });
});

describe('largeTitleStyle', () => {
  it('leaves the color to the system by default', () => {
    expect(largeTitleStyle()).not.toHaveProperty('color');
    expect(largeTitleStackOptions(WheelyTheme.dark, 'Durham').headerLargeTitleStyle).toEqual(
      largeTitleStyle(),
    );
  });

  it('takes a color for a title drawn over the home scene', () => {
    expect(largeTitleStyle('#000000')).toMatchObject({ color: '#000000' });
  });
});
