import { describe, expect, it } from 'vitest';
import { getGearSuggestion } from './weather';

describe('Gear Suggestions', () => {
  const base = {
    feelsLike: 72,
    windSpeed: 5,
    rainChance: 0,
    dewpoint: 50,
    hourly: [],
  };

  const isPerfectHeadline = (text: string) =>
    /long way|extra loop|extra miles|ideal|prime|beautiful riding|favor extra|clean roads|worth making count/i.test(
      text,
    );

  const matchesItem = (gear: ReturnType<typeof getGearSuggestion>, pattern: RegExp) =>
    gear.items.some((item) => pattern.test(item.label) || pattern.test(item.qualifier ?? ''));

  it('shows PERFECT when all conditions are genuinely good', () => {
    const gear = getGearSuggestion(base, 'casual');
    expect(isPerfectHeadline(gear.headline)).toBe(true);
    expect(matchesItem(gear, /short-sleeve top/i)).toBe(true);
    expect(matchesItem(gear, /^shorts$/i)).toBe(true);
  });

  it('shows baseline performance kit when all conditions are genuinely good', () => {
    const gear = getGearSuggestion(base, 'pro');
    expect(isPerfectHeadline(gear.headline)).toBe(true);
    expect(matchesItem(gear, /short-sleeve jersey/i)).toBe(true);
    expect(matchesItem(gear, /bib shorts/i)).toBe(true);
  });

  it('does not show PERFECT when rain is high, even on a warm day', () => {
    const gear = getGearSuggestion(
      {
        ...base,
        rainChance: 70,
        hourly: [{ feelsLike: 72, windSpeed: 5, rainChance: 70, dewpoint: 50, uv: 0 }],
      },
      'casual',
    );
    expect(isPerfectHeadline(gear.headline)).toBe(false);
    expect(matchesItem(gear, /short-sleeve top/i)).toBe(true);
    expect(matchesItem(gear, /^shorts$/i)).toBe(true);
    expect(matchesItem(gear, /rain/i)).toBe(true);
  });

  it('does not show PERFECT when wind is high, even on a warm day', () => {
    const gear = getGearSuggestion(
      {
        ...base,
        windSpeed: 20,
        hourly: [{ feelsLike: 72, windSpeed: 20, rainChance: 0, dewpoint: 50, uv: 0 }],
      },
      'casual',
    );
    expect(isPerfectHeadline(gear.headline)).toBe(false);
    expect(matchesItem(gear, /short-sleeve top/i)).toBe(true);
    expect(matchesItem(gear, /^shorts$/i)).toBe(true);
    expect(matchesItem(gear, /wind/i)).toBe(true);
  });

  it('still shows PERFECT on an ideal day when only benign UV items are added', () => {
    const gear = getGearSuggestion(
      {
        ...base,
        hourly: [{ feelsLike: 72, windSpeed: 5, rainChance: 0, dewpoint: 50, uv: 8 }],
      },
      'casual',
    );

    expect(isPerfectHeadline(gear.headline)).toBe(true);
    expect(matchesItem(gear, /short-sleeve top/i)).toBe(true);
    expect(matchesItem(gear, /^shorts$/i)).toBe(true);
    expect(matchesItem(gear, /sunscreen/i)).toBe(true);
    expect(matchesItem(gear, /sunglasses/i)).toBe(true);
  });

  it('suppresses celebratory PERFECT copy when the verdict is only maybe', () => {
    const gear = getGearSuggestion(base, 'casual', 'maybe');
    expect(isPerfectHeadline(gear.headline)).toBe(false);
    expect(matchesItem(gear, /short-sleeve top/i)).toBe(true);
    expect(matchesItem(gear, /^shorts$/i)).toBe(true);
  });

  it('suppresses celebratory PERFECT copy when the verdict is no', () => {
    const gear = getGearSuggestion(base, 'pro', 'no');
    expect(isPerfectHeadline(gear.headline)).toBe(false);
  });

  it('still shows PERFECT when the verdict is an unambiguous yes', () => {
    const gear = getGearSuggestion(base, 'casual', 'yes');
    expect(isPerfectHeadline(gear.headline)).toBe(true);
  });

  it('falls back to a quiet NEUTRAL base on an ideal day with a real caveat', () => {
    const gear = getGearSuggestion(
      {
        ...base,
        dewpoint: 70,
        hourly: [{ feelsLike: 72, windSpeed: 5, rainChance: 0, dewpoint: 70, uv: 0 }],
      },
      'casual',
    );

    expect(isPerfectHeadline(gear.headline)).toBe(false);
    expect(matchesItem(gear, /muggy/i)).toBe(true);
  });

  it('picks one consistent bottom across a changing three-hour window', () => {
    const gear = getGearSuggestion(
      {
        feelsLike: 52,
        windSpeed: 5,
        rainChance: 0,
        dewpoint: 50,
        hourly: [
          { feelsLike: 52, windSpeed: 5, rainChance: 0, dewpoint: 50, uv: 3 },
          { feelsLike: 66, windSpeed: 5, rainChance: 0, dewpoint: 50, uv: 5 },
          { feelsLike: 84, windSpeed: 5, rainChance: 0, dewpoint: 50, uv: 7 },
          { feelsLike: 20, windSpeed: 30, rainChance: 80, dewpoint: 50, uv: 0 },
        ],
      },
      'casual',
    );

    const bottoms = gear.items.filter((item) => item.slot === 'bottom');
    expect(bottoms).toHaveLength(1);
    // The third-hour hot peak wins; severe conditions in hour four are outside the kit window.
    expect(bottoms[0].label).toMatch(/^shorts$/i);
    expect(matchesItem(gear, /insulated|rain jacket|windbreaker/i)).toBe(false);
  });

  it('keeps casual baseline bottoms when muggy neutral weather replaces the top', () => {
    const gear = getGearSuggestion(
      {
        ...base,
        dewpoint: 70,
        hourly: [{ feelsLike: 72, windSpeed: 5, rainChance: 0, dewpoint: 70, uv: 0 }],
      },
      'casual',
    );

    expect(isPerfectHeadline(gear.headline)).toBe(false);
    expect(matchesItem(gear, /moisture-wicking short-sleeve top/i)).toBe(true);
    expect(matchesItem(gear, /^shorts$/i)).toBe(true);
  });

  it('keeps performance baseline clothing when neutral weather adds support items', () => {
    const gear = getGearSuggestion(
      {
        ...base,
        windSpeed: 20,
        hourly: [{ feelsLike: 72, windSpeed: 20, rainChance: 0, dewpoint: 50, uv: 8 }],
      },
      'pro',
    );

    expect(isPerfectHeadline(gear.headline)).toBe(false);
    expect(matchesItem(gear, /short-sleeve jersey/i)).toBe(true);
    expect(matchesItem(gear, /bib shorts/i)).toBe(true);
    expect(matchesItem(gear, /wind vest/i)).toBe(true);
    expect(matchesItem(gear, /sunscreen/i)).toBe(true);
  });
});
