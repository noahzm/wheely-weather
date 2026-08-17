import { describe, expect, it } from 'vitest';
import { getGearSuggestion } from './weather';

describe('Gear Suggestions', () => {
  const base = {
    temperature: 72,
    feelsLike: 72,
    windSpeed: 5,
    rainChance: 0,
    dewpoint: 50,
    hourly: [],
    pastHourly: [],
  };

  const matchesItem = (gear: ReturnType<typeof getGearSuggestion>, pattern: RegExp) =>
    gear.items.some((item) => pattern.test(item.label));

  it('shows the casual baseline outfit when all conditions are genuinely good', () => {
    const gear = getGearSuggestion(base, 'casual');
    expect(matchesItem(gear, /short-sleeve top/i)).toBe(true);
    expect(matchesItem(gear, /^shorts$/i)).toBe(true);
  });

  it('shows the performance baseline outfit when all conditions are genuinely good', () => {
    const gear = getGearSuggestion(base, 'pro');
    expect(matchesItem(gear, /short-sleeve jersey/i)).toBe(true);
    expect(matchesItem(gear, /bib shorts/i)).toBe(true);
  });

  it('adds rain gear on a warm rainy day', () => {
    const gear = getGearSuggestion(
      {
        ...base,
        rainChance: 70,
        hourly: [{ temperature: 72, windSpeed: 5, rainChance: 70, dewpoint: 50, uv: 0 }],
      },
      'casual',
    );
    expect(matchesItem(gear, /short-sleeve top/i)).toBe(true);
    expect(matchesItem(gear, /^shorts$/i)).toBe(true);
    expect(matchesItem(gear, /rain/i)).toBe(true);
  });

  it('adds wind gear on a warm windy day', () => {
    const gear = getGearSuggestion(
      {
        ...base,
        windSpeed: 20,
        hourly: [{ temperature: 72, windSpeed: 20, rainChance: 0, dewpoint: 50, uv: 0 }],
      },
      'casual',
    );
    expect(matchesItem(gear, /short-sleeve top/i)).toBe(true);
    expect(matchesItem(gear, /^shorts$/i)).toBe(true);
    expect(matchesItem(gear, /wind/i)).toBe(true);
  });

  it('adds UV items on an otherwise ideal day', () => {
    const gear = getGearSuggestion(
      {
        ...base,
        hourly: [{ temperature: 72, windSpeed: 5, rainChance: 0, dewpoint: 50, uv: 8 }],
      },
      'casual',
    );

    expect(matchesItem(gear, /short-sleeve top/i)).toBe(true);
    expect(matchesItem(gear, /^shorts$/i)).toBe(true);
    expect(matchesItem(gear, /sunscreen/i)).toBe(true);
    expect(matchesItem(gear, /sunglasses/i)).toBe(true);
  });

  it('picks one consistent bottom across a changing three-hour window', () => {
    const gear = getGearSuggestion(
      {
        temperature: 52,
        feelsLike: 52,
        windSpeed: 5,
        rainChance: 0,
        dewpoint: 50,
        hourly: [
          { temperature: 52, windSpeed: 5, rainChance: 0, dewpoint: 50, uv: 3 },
          { temperature: 66, windSpeed: 5, rainChance: 0, dewpoint: 50, uv: 5 },
          { temperature: 84, windSpeed: 5, rainChance: 0, dewpoint: 50, uv: 7 },
          { temperature: 20, windSpeed: 30, rainChance: 80, dewpoint: 50, uv: 0 },
        ],
        pastHourly: [],
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
        hourly: [{ temperature: 72, windSpeed: 5, rainChance: 0, dewpoint: 70, uv: 0 }],
      },
      'casual',
    );

    expect(matchesItem(gear, /wicking top/i)).toBe(true);
    expect(matchesItem(gear, /^shorts$/i)).toBe(true);
  });

  it('keeps performance baseline clothing when neutral weather adds support items', () => {
    const gear = getGearSuggestion(
      {
        ...base,
        windSpeed: 20,
        hourly: [{ temperature: 72, windSpeed: 20, rainChance: 0, dewpoint: 50, uv: 8 }],
      },
      'pro',
    );

    expect(matchesItem(gear, /short-sleeve jersey/i)).toBe(true);
    expect(matchesItem(gear, /bib shorts/i)).toBe(true);
    expect(matchesItem(gear, /wind vest/i)).toBe(true);
    expect(matchesItem(gear, /sunscreen/i)).toBe(true);
  });

  it('splits a cold rainy day into wear (outfit) and bring (add-ons)', () => {
    const gear = getGearSuggestion(
      {
        temperature: 40,
        feelsLike: 40,
        windSpeed: 5,
        rainChance: 70,
        dewpoint: 30,
        hourly: [{ temperature: 40, windSpeed: 5, rainChance: 70, dewpoint: 30, uv: 0 }],
      },
      'casual',
    );

    const wearLabels = gear.wear.map((item) => item.label).join(' ');
    expect(wearLabels).toMatch(/long-sleeve top/i);
    expect(wearLabels).toMatch(/long pants/i);
    expect(wearLabels).toMatch(/gloves/i);
    expect(gear.bring.some((item) => /rain jacket/i.test(item.label))).toBe(true);
    expect(gear.wear.some((item) => /rain jacket/i.test(item.label))).toBe(false);
  });

  it('keeps a muggy slot-override top in wear, not bring', () => {
    const gear = getGearSuggestion(
      {
        ...base,
        dewpoint: 70,
        hourly: [{ temperature: 72, windSpeed: 5, rainChance: 0, dewpoint: 70, uv: 0 }],
      },
      'casual',
    );

    expect(gear.wear.some((item) => /wicking/i.test(item.label))).toBe(true);
    expect(gear.bring.some((item) => /wicking/i.test(item.label))).toBe(false);
  });

  it('puts the temp-swing removable layer in bring', () => {
    const gear = getGearSuggestion(
      {
        temperature: 50,
        feelsLike: 50,
        windSpeed: 5,
        rainChance: 0,
        dewpoint: 40,
        hourly: [
          { temperature: 50, windSpeed: 5, rainChance: 0, dewpoint: 40, uv: 0 },
          { temperature: 68, windSpeed: 5, rainChance: 0, dewpoint: 40, uv: 0 },
        ],
        pastHourly: [],
      },
      'casual',
    );

    expect(gear.bring.some((item) => /removable layer/i.test(item.label))).toBe(true);
  });

  it('leaves bring empty on a perfect day', () => {
    const gear = getGearSuggestion(base, 'casual');
    expect(gear.bring).toHaveLength(0);
    expect(gear.wear.length).toBeGreaterThan(0);
  });

  it('covers freezing-to-scorching extremes with possible rain and null sensor readings', () => {
    const gear = getGearSuggestion(
      {
        temperature: 25,
        feelsLike: 25,
        windSpeed: 5,
        rainChance: 40,
        dewpoint: null,
        hourly: [
          { temperature: 25, windSpeed: 5, rainChance: 40, dewpoint: null, uv: null },
          { temperature: 95, windSpeed: 5, rainChance: 40, dewpoint: null, uv: null },
        ],
      },
      'casual',
    );

    expect(matchesItem(gear, /insulated gloves/i)).toBe(true);
    expect(matchesItem(gear, /quick-dry layer/i)).toBe(true);
    expect(matchesItem(gear, /removable layer/i)).toBe(true);
  });

  it('suggests light layers in the mild-cool band', () => {
    const gear = getGearSuggestion(
      {
        ...base,
        temperature: 60,
        feelsLike: 60,
        hourly: [{ temperature: 60, windSpeed: 5, rainChance: 0, dewpoint: 50, uv: 0 }],
      },
      'casual',
    );

    expect(matchesItem(gear, /short or light long sleeve/i)).toBe(true);
  });

  it('falls back to current conditions (with null dewpoint) when hourly data is empty', () => {
    const gear = getGearSuggestion(
      {
        temperature: 72,
        windSpeed: 5,
        rainChance: 0,
        dewpoint: null,
        uvIndex: 7,
        hourly: [],
        pastHourly: [],
      },
      'casual',
    );

    expect(matchesItem(gear, /sunscreen/i)).toBe(true);
    expect(matchesItem(gear, /short-sleeve top/i)).toBe(true);
  });

  it('partitions items exactly into wear and bring', () => {
    const gear = getGearSuggestion(
      {
        temperature: 40,
        feelsLike: 40,
        windSpeed: 20,
        rainChance: 70,
        dewpoint: 30,
        hourly: [{ temperature: 40, windSpeed: 20, rainChance: 70, dewpoint: 30, uv: 8 }],
      },
      'pro',
    );

    expect(gear.wear.length + gear.bring.length).toBe(gear.items.length);
    expect([...gear.wear, ...gear.bring].every((item) => gear.items.includes(item))).toBe(true);
  });

  it('recommends wet road spray gear when wet weather code is present but rain chance is low', () => {
    const gear = getGearSuggestion(
      {
        ...base,
        rainChance: 10,
        weatherCode: 61,
        hourly: [{ temperature: 65, windSpeed: 5, rainChance: 10, dewpoint: 50, uv: 0 }],
      },
      'pro',
    );
    expect(matchesItem(gear, /shoe covers or fenders|wet road shell/i)).toBe(true);
  });

  it('recommends wet road spray gear when rain just ended', () => {
    const gear = getGearSuggestion(
      {
        ...base,
        rainChance: 10,
        pastHourly: [{ temperature: 65, windSpeed: 5, rainChance: 60, dewpoint: 50, uv: 0 }],
        hourly: [{ temperature: 65, windSpeed: 5, rainChance: 10, dewpoint: 50, uv: 0 }],
      },
      'pro',
    );
    expect(matchesItem(gear, /shoe covers or fenders|wet road shell/i)).toBe(true);
  });

  it('does not treat upcoming rain chance as wet roads', () => {
    const gear = getGearSuggestion(
      {
        ...base,
        rainChance: 25,
        hourly: [{ temperature: 65, windSpeed: 5, rainChance: 25, dewpoint: 50, uv: 0 }],
      },
      'pro',
    );
    expect(matchesItem(gear, /shoe covers or fenders|wet road shell/i)).toBe(false);
  });
});
