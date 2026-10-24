import { describe, expect, it } from 'vitest';
import { THRESHOLDS } from './constants';
import { getDayGearSuggestion, getGearSuggestion, getWearRows } from './weather';
import { makeDay, makeHour, makeWeather } from '@/test-utils/weather';
import type { GearTipItem } from '@/types/weather';

describe('Gear Suggestions', () => {
  const base = makeWeather({ temperature: 72, windSpeed: 5, rainChance: 0, dewpoint: 50 });

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
        hourly: [makeHour({ temperature: 72, windSpeed: 5, rainChance: 70, dewpoint: 50, uv: 0 })],
      },
      'casual',
    );
    expect(matchesItem(gear, /short-sleeve top/i)).toBe(true);
    expect(matchesItem(gear, /^shorts$/i)).toBe(true);
    expect(matchesItem(gear, /rain/i)).toBe(true);
  });

  it('adds wind gear on a mild windy day', () => {
    const gear = getGearSuggestion(
      {
        ...base,
        windSpeed: 20,
        hourly: [makeHour({ temperature: 60, windSpeed: 20, rainChance: 0, dewpoint: 50, uv: 0 })],
      },
      'casual',
    );
    expect(matchesItem(gear, /short or light long sleeve/i)).toBe(true);
    expect(matchesItem(gear, /shorts or light pants/i)).toBe(true);
    expect(matchesItem(gear, /wind/i)).toBe(true);
  });

  it('adds UV items on an otherwise ideal day', () => {
    const gear = getGearSuggestion(
      {
        ...base,
        hourly: [makeHour({ temperature: 72, windSpeed: 5, rainChance: 0, dewpoint: 50, uv: 8 })],
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
      makeWeather({
        temperature: 52,
        feelsLike: 52,
        windSpeed: 5,
        rainChance: 0,
        dewpoint: 50,
        hourly: [
          makeHour({ temperature: 52, windSpeed: 5, rainChance: 0, dewpoint: 50, uv: 3 }),
          makeHour({ temperature: 66, windSpeed: 5, rainChance: 0, dewpoint: 50, uv: 5 }),
          makeHour({ temperature: 84, windSpeed: 5, rainChance: 0, dewpoint: 50, uv: 7 }),
          makeHour({ temperature: 20, windSpeed: 30, rainChance: 80, dewpoint: 50, uv: 0 }),
        ],
        pastHourly: [],
      }),
      'casual',
    );

    const bottoms = gear.items.filter((item) => item.slot === 'bottom');
    expect(bottoms).toHaveLength(1);
    // The third-hour hot peak wins; severe conditions in hour four are outside the kit window.
    expect(bottoms[0]?.label).toMatch(/^shorts$/i);
    expect(matchesItem(gear, /insulated|rain jacket|windbreaker/i)).toBe(false);
  });

  it('keeps casual baseline bottoms when muggy neutral weather replaces the top', () => {
    const gear = getGearSuggestion(
      {
        ...base,
        dewpoint: 70,
        hourly: [makeHour({ temperature: 72, windSpeed: 5, rainChance: 0, dewpoint: 70, uv: 0 })],
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
        hourly: [makeHour({ temperature: 62, windSpeed: 20, rainChance: 0, dewpoint: 50, uv: 8 })],
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
      makeWeather({
        temperature: 40,
        feelsLike: 40,
        windSpeed: 5,
        rainChance: 70,
        dewpoint: 30,
        hourly: [makeHour({ temperature: 40, windSpeed: 5, rainChance: 70, dewpoint: 30, uv: 0 })],
      }),
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
        hourly: [makeHour({ temperature: 72, windSpeed: 5, rainChance: 0, dewpoint: 70, uv: 0 })],
      },
      'casual',
    );

    expect(gear.wear.some((item) => /wicking/i.test(item.label))).toBe(true);
    expect(gear.bring.some((item) => /wicking/i.test(item.label))).toBe(false);
  });

  it('puts the temp-swing removable layer in bring', () => {
    const gear = getGearSuggestion(
      makeWeather({
        temperature: 50,
        feelsLike: 50,
        windSpeed: 5,
        rainChance: 0,
        dewpoint: 40,
        hourly: [
          makeHour({ temperature: 50, windSpeed: 5, rainChance: 0, dewpoint: 40, uv: 0 }),
          makeHour({ temperature: 68, windSpeed: 5, rainChance: 0, dewpoint: 40, uv: 0 }),
        ],
        pastHourly: [],
      }),
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
      makeWeather({
        temperature: 25,
        feelsLike: 25,
        windSpeed: 5,
        rainChance: 40,
        hourly: [
          makeHour({ temperature: 25, windSpeed: 5, rainChance: 40, dewpoint: null, uv: null }),
          makeHour({ temperature: 95, windSpeed: 5, rainChance: 40, dewpoint: null, uv: null }),
        ],
      }),
      'casual',
    );

    expect(matchesItem(gear, /insulated gloves/i)).toBe(true);
    expect(matchesItem(gear, /quick-dry layer/i)).toBe(true);
    // The insulated jacket is the layer that comes off as it warms.
    expect(matchesItem(gear, /removable layer/i)).toBe(false);
  });

  it('suggests light layers in the mild-cool band', () => {
    const gear = getGearSuggestion(
      {
        ...base,
        temperature: 60,
        feelsLike: 60,
        hourly: [makeHour({ temperature: 60, windSpeed: 5, rainChance: 0, dewpoint: 50, uv: 0 })],
      },
      'casual',
    );

    expect(matchesItem(gear, /short or light long sleeve/i)).toBe(true);
  });

  it('falls back to current conditions when hourly data is empty', () => {
    const gear = getGearSuggestion(
      makeWeather({
        temperature: 72,
        windSpeed: 5,
        rainChance: 0,
        uvIndex: 7,
        hourly: [],
        pastHourly: [],
      }),
      'casual',
    );

    expect(matchesItem(gear, /sunscreen/i)).toBe(true);
    expect(matchesItem(gear, /short-sleeve top/i)).toBe(true);
  });

  it('partitions items exactly into wear and bring', () => {
    const gear = getGearSuggestion(
      makeWeather({
        temperature: 40,
        feelsLike: 40,
        windSpeed: 20,
        rainChance: 70,
        dewpoint: 30,
        hourly: [makeHour({ temperature: 40, windSpeed: 20, rainChance: 70, dewpoint: 30, uv: 8 })],
      }),
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
        hourly: [makeHour({ temperature: 65, windSpeed: 5, rainChance: 10, dewpoint: 50, uv: 0 })],
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
        pastHourly: [
          makeHour({ temperature: 65, windSpeed: 5, rainChance: 60, dewpoint: 50, uv: 0 }),
        ],
        hourly: [makeHour({ temperature: 65, windSpeed: 5, rainChance: 10, dewpoint: 50, uv: 0 })],
      },
      'pro',
    );
    expect(matchesItem(gear, /shoe covers or fenders|wet road shell/i)).toBe(true);
  });

  describe('with the verdict’s ride window', () => {
    const hr = (hour: number, temperature: number, rainChance: number) =>
      makeHour({ hour, temperature, windSpeed: 5, rainChance, dewpoint: 50, uv: 0 });
    // Cold and pouring now (9–11), mild and dry for the noon–3 PM window.
    const waitDay = {
      ...base,
      hourly: [
        hr(9, 42, 90),
        hr(10, 44, 90),
        hr(11, 50, 60),
        hr(12, 70, 5),
        hr(13, 72, 5),
        hr(14, 72, 5),
        hr(15, 60, 5),
      ],
    };
    const window = { startHour: 12, endHour: 15 };

    it('dresses for the window, not the next few hours', () => {
      const now = getGearSuggestion(waitDay, 'casual');
      const later = getGearSuggestion(waitDay, 'casual', window);
      expect(matchesItem(now, /rain/i)).toBe(true);
      expect(matchesItem(later, /short-sleeve top/i)).toBe(true);
      expect(matchesItem(later, /rain jacket/i)).toBe(false);
    });

    it('counts rain before a later window as wet roads', () => {
      const gear = getGearSuggestion(waitDay, 'pro', window);
      expect(matchesItem(gear, /shoe covers or fenders|wet road shell/i)).toBe(true);
    });

    it('falls back to the given conditions when the window is beyond the hourly data', () => {
      const gear = getGearSuggestion({ ...waitDay, temperature: 40 }, 'casual', {
        startHour: 20,
        endHour: 23,
      });
      expect(matchesItem(gear, /short-sleeve top/i)).toBe(false);
    });
  });

  describe('wet roads only from recent rain', () => {
    const hr = (hour: number, rainChance: number) =>
      makeHour({ hour, temperature: 65, windSpeed: 5, rainChance, dewpoint: 50, uv: 0 });
    // Showers at 8 PM, then dry overnight and all morning; ride 3–6 PM tomorrow.
    const overnight = {
      ...base,
      rainChance: 60,
      hourly: [hr(20, 60), ...Array.from({ length: 19 }, (_, i) => hr((21 + i) % 24, 0))],
    };
    const tomorrowAfternoon = { startHour: 15, endHour: 18 };
    const fenders = /shoe covers or fenders|wet road shell/i;

    it('ignores rain that ended many hours before the ride', () => {
      expect(matchesItem(getGearSuggestion(overnight, 'pro', tomorrowAfternoon), fenders)).toBe(
        false,
      );
    });

    it('ignores rain falling now when the ride is much later', () => {
      const rainingNow = { ...overnight, weatherCode: 61, hourly: overnight.hourly.slice(1) };
      expect(matchesItem(getGearSuggestion(rainingNow, 'pro', tomorrowAfternoon), fenders)).toBe(
        false,
      );
    });

    it('still counts rain within a few hours of the ride', () => {
      const lateShower = {
        ...overnight,
        hourly: overnight.hourly.map((h) => (h.hour === 12 ? { ...h, rainChance: 60 } : h)),
      };
      expect(matchesItem(getGearSuggestion(lateShower, 'pro', tomorrowAfternoon), fenders)).toBe(
        true,
      );
    });
  });

  it('packs a light layer, not a rain jacket, for a likely trace', () => {
    const trace = (precipitation: number | null) => ({
      ...base,
      rainChance: 70,
      precipitation,
      hourly: [
        makeHour({
          temperature: 72,
          windSpeed: 5,
          rainChance: 70,
          precipitation,
          dewpoint: 50,
          uv: 0,
        }),
      ],
    });
    const sprinkle = getGearSuggestion(trace(0.1), 'casual');
    expect(matchesItem(sprinkle, /rain jacket/i)).toBe(false);
    expect(matchesItem(sprinkle, /quick-dry layer/i)).toBe(true);
    // A real amount, or an unknown one, still calls for the jacket.
    expect(matchesItem(getGearSuggestion(trace(1.5), 'casual'), /rain jacket/i)).toBe(true);
    expect(matchesItem(getGearSuggestion(trace(null), 'casual'), /rain jacket/i)).toBe(true);
  });

  it('adds sunscreen from UV 3, and sunglasses from 8', () => {
    const sunny = (uv: number) =>
      getGearSuggestion(
        {
          ...base,
          hourly: [makeHour({ temperature: 72, windSpeed: 5, rainChance: 0, dewpoint: 50, uv })],
        },
        'casual',
      );
    expect(matchesItem(sunny(2), /sunscreen/i)).toBe(false);
    expect(matchesItem(sunny(4), /sunscreen/i)).toBe(true);
    expect(matchesItem(sunny(4), /sunglasses/i)).toBe(false);
    expect(matchesItem(sunny(8), /sunglasses/i)).toBe(true);
  });

  it('skips the windbreaker once even the coolest hour is warm', () => {
    const windy = (temperature: number) => ({
      ...base,
      temperature,
      windSpeed: 20,
      hourly: [makeHour({ temperature, windSpeed: 20, rainChance: 0, dewpoint: 50, uv: 0 })],
    });
    expect(matchesItem(getGearSuggestion(windy(92), 'casual'), /windbreaker/i)).toBe(false);
    expect(matchesItem(getGearSuggestion(windy(72), 'casual'), /windbreaker/i)).toBe(false);
    expect(matchesItem(getGearSuggestion(windy(65), 'casual'), /windbreaker/i)).toBe(true);
  });

  it('does not treat upcoming rain chance as wet roads', () => {
    const gear = getGearSuggestion(
      {
        ...base,
        rainChance: 25,
        hourly: [makeHour({ temperature: 65, windSpeed: 5, rainChance: 25, dewpoint: 50, uv: 0 })],
      },
      'pro',
    );
    expect(matchesItem(gear, /shoe covers or fenders|wet road shell/i)).toBe(false);
  });

  it('suppresses wet road tip when active rain is already expected (>30%)', () => {
    const gear = getGearSuggestion(
      {
        ...base,
        rainChance: 40,
        pastHourly: [
          makeHour({ temperature: 65, windSpeed: 5, rainChance: 60, dewpoint: 50, uv: 0 }),
        ],
        hourly: [makeHour({ temperature: 65, windSpeed: 5, rainChance: 40, dewpoint: 50, uv: 0 })],
      },
      'pro',
    );
    expect(matchesItem(gear, /rain jacket|rain shell/i)).toBe(true);
    expect(matchesItem(gear, /wet road shell/i)).toBe(false);
  });

  it('assigns cycling-specific icon keys in pro mode', () => {
    const coolGear = getGearSuggestion(
      {
        ...base,
        temperature: 52,
        hourly: [makeHour({ temperature: 52, windSpeed: 5, rainChance: 0, dewpoint: 40, uv: 0 })],
      },
      'pro',
    );
    const icons = Object.fromEntries(coolGear.wear.map((item) => [item.label, item.icon]));
    expect(icons['Short-sleeve jersey']).toBe('Jersey');
    expect(icons['Arm warmers']).toBe('ArmWarmers');
    expect(icons['Knee warmers']).toBe('KneeWarmers');
    expect(icons.Gilet).toBe('Gilet');

    const rainGear = getGearSuggestion(
      {
        ...base,
        rainChance: 60,
        hourly: [makeHour({ temperature: 65, windSpeed: 5, rainChance: 60, dewpoint: 50, uv: 0 })],
      },
      'pro',
    );
    const shoeCovers = rainGear.bring.find((item) => item.label === 'Shoe covers');
    const rainJacket = rainGear.bring.find((item) => item.label === 'Rain jacket');
    expect(shoeCovers?.icon).toBe('ShoeCovers');
    expect(rainJacket?.icon).toBe('CyclingJacket');

    const windyGear = getGearSuggestion(
      {
        ...base,
        windSpeed: 25,
        hourly: [makeHour({ temperature: 65, windSpeed: 25, rainChance: 0, dewpoint: 50, uv: 0 })],
      },
      'pro',
    );
    const windVest = windyGear.bring.find((item) => item.label === 'Wind vest');
    expect(windVest?.icon).toBe('Gilet');
  });

  it('ignores today’s overlapping evening hours when dressing for tomorrow’s window', () => {
    // At 4 PM (16) today it is pouring (90% rain, 42°F), while tomorrow at 3–5 PM (15–17) is warm and dry (72°F, 0% rain).
    const hours = Array.from({ length: 26 }, (_, idx) => {
      const hour = (16 + idx) % 24;
      const isTodayEvening = idx < 2;
      return makeHour({
        hour,
        temperature: isTodayEvening ? 42 : 72,
        windSpeed: 5,
        rainChance: isTodayEvening ? 90 : 0,
        dewpoint: 50,
        uv: 0,
      });
    });
    const gear = getGearSuggestion({ ...base, hourly: hours }, 'casual', {
      startHour: 15,
      endHour: 17,
      tomorrow: true,
    });
    expect(matchesItem(gear, /short-sleeve top/i)).toBe(true);
    expect(matchesItem(gear, /rain jacket|jacket/i)).toBe(false);
  });

  it('shifts kit temperature bands with the rider’s acclimatized thresholds', () => {
    const chillyDay = {
      ...base,
      temperature: 52,
      hourly: [makeHour({ temperature: 52, windSpeed: 5, rainChance: 0, dewpoint: 45, uv: 0 })],
    };
    const coldAdapted = {
      ...THRESHOLDS,
      TEMPERATURE: { ...THRESHOLDS.TEMPERATURE, FAIR_MIN: 44 }, // coldShift = 6 -> COOL cutoff drops from 55 to 49
    };
    // Unadapted rider at 52°F gets COOL kit (Knee warmers + Gilet); cold-adapted rider gets MILD_COOL (no knee warmers).
    expect(matchesItem(getGearSuggestion(chillyDay, 'pro'), /knee warmers/i)).toBe(true);
    expect(
      matchesItem(getGearSuggestion(chillyDay, 'pro', null, coldAdapted), /knee warmers/i),
    ).toBe(false);
  });

  it('keeps winter kit on a cold ride for a cold-adapted rider', () => {
    const nearFreezing = {
      ...base,
      temperature: 34,
      hourly: [makeHour({ temperature: 34, windSpeed: 5, rainChance: 0, dewpoint: 25, uv: 0 })],
    };
    // A winter-hardened rider: the rating's full 18°F cold shift.
    const hardened = {
      ...THRESHOLDS,
      TEMPERATURE: { ...THRESHOLDS.TEMPERATURE, FAIR_MIN: 32 },
    };
    const gear = getGearSuggestion(nearFreezing, 'pro', null, hardened);
    expect(matchesItem(gear, /thermal bib tights/i)).toBe(true);
    expect(matchesItem(gear, /^bib shorts$|knee warmers/i)).toBe(false);
  });

  it('dresses a cold ride with gloves and ear cover in both modes', () => {
    const cold = {
      ...base,
      temperature: 40,
      hourly: [makeHour({ temperature: 40, windSpeed: 5, rainChance: 0, dewpoint: 30, uv: 0 })],
    };
    expect(matchesItem(getGearSuggestion(cold, 'casual'), /wool cap/i)).toBe(true);
    expect(matchesItem(getGearSuggestion(cold, 'pro'), /skull cap or headband/i)).toBe(true);
    const cool = {
      ...base,
      temperature: 48,
      hourly: [makeHour({ temperature: 48, windSpeed: 5, rainChance: 0, dewpoint: 30, uv: 0 })],
    };
    expect(matchesItem(getGearSuggestion(cool, 'casual'), /light gloves/i)).toBe(true);
    expect(matchesItem(getGearSuggestion(cool, 'pro'), /light full-finger gloves/i)).toBe(true);
  });

  describe('outer layers', () => {
    const windySwing = (from: number) => ({
      ...base,
      temperature: from,
      windSpeed: 20,
      hourly: [
        makeHour({ temperature: from, windSpeed: 20, rainChance: 0, dewpoint: 40, uv: 0 }),
        makeHour({ temperature: from + 16, windSpeed: 20, rainChance: 0, dewpoint: 40, uv: 0 }),
      ],
    });
    const labels = (gear: ReturnType<typeof getGearSuggestion>) =>
      gear.items.map((item) => item.label);

    it('adds no wind layer beside the gilet a cool kit already has', () => {
      const gear = getGearSuggestion(windySwing(50), 'pro');
      expect(gear.wear.some((item) => item.label === 'Gilet')).toBe(true);
      expect(labels(gear)).not.toContain('Wind vest');
      expect(labels(gear)).not.toContain('Gilet or arm warmers');
    });

    it('adds no windbreaker over a cold kit’s jacket', () => {
      const gear = getGearSuggestion(windySwing(40), 'casual');
      expect(labels(gear)).toContain('Jacket');
      expect(labels(gear)).not.toContain('Windbreaker');
      expect(labels(gear)).not.toContain('Removable layer');
    });

    it('packs one wind layer when the kit has none', () => {
      const gear = getGearSuggestion(windySwing(58), 'pro');
      expect(gear.bring.map((item) => item.label)).toContain('Wind vest');
      expect(labels(gear)).not.toContain('Gilet or arm warmers');
    });

    it('still packs a rain shell beside a gilet, which keeps out wind, not rain', () => {
      const showery = {
        ...base,
        temperature: 50,
        rainChance: 35,
        hourly: [makeHour({ temperature: 50, windSpeed: 5, rainChance: 35, dewpoint: 40, uv: 0 })],
      };
      const gear = getGearSuggestion(showery, 'pro');
      expect(labels(gear)).toContain('Gilet');
      expect(gear.bring.map((item) => item.label)).toContain('Packable rain shell');
    });
  });

  it('lists an item two tips share only once', () => {
    const freezingRain = {
      ...base,
      temperature: 30,
      rainChance: 80,
      hourly: [
        makeHour({
          temperature: 30,
          windSpeed: 5,
          rainChance: 80,
          precipitation: 2,
          dewpoint: 28,
          uv: 0,
        }),
      ],
    };
    const gear = getGearSuggestion(freezingRain, 'pro');
    expect(gear.items.filter((item) => item.label === 'Shoe covers')).toHaveLength(1);
    expect(gear.wear.some((item) => item.label === 'Shoe covers')).toBe(true);
  });

  it('counts recent rain by its amount when one is known', () => {
    const afterHour = (pastHour: Partial<Parameters<typeof makeHour>[0]>) => ({
      ...base,
      rainChance: 0,
      pastHourly: [makeHour({ temperature: 65, windSpeed: 5, dewpoint: 50, ...pastHour })],
      hourly: [makeHour({ temperature: 65, windSpeed: 5, rainChance: 0, dewpoint: 50, uv: 0 })],
    });
    const fenders = /shoe covers or fenders|wet road shell/i;
    // A 40% chance that came to nothing left the road dry.
    expect(
      matchesItem(
        getGearSuggestion(afterHour({ rainChance: 40, precipitation: 0 }), 'pro'),
        fenders,
      ),
    ).toBe(false);
    // A low-chance shower that did fall wet it.
    expect(
      matchesItem(
        getGearSuggestion(afterHour({ rainChance: 10, precipitation: 1 }), 'pro'),
        fenders,
      ),
    ).toBe(true);
  });

  it('adds sunscreen to a day’s kit from its window’s UV', () => {
    const day = makeDay({ rideWindow: { startHour: 11, endHour: 14, tempLow: 68, tempHigh: 72 } });
    expect(matchesItem(getDayGearSuggestion({ ...day, uvMax: 6 }, 'casual'), /sunscreen/i)).toBe(
      true,
    );
    expect(matchesItem(getDayGearSuggestion(day, 'casual'), /sunscreen/i)).toBe(false);
  });

  it('builds a daily kit preview from a day’s ride window in getDayGearSuggestion', () => {
    const day = makeDay({
      low: 38,
      high: 70,
      windSpeed: 18,
      rainChance: 10,
      rideWindow: { startHour: 12, endHour: 15, tempLow: 58, tempHigh: 64 },
    });
    const gear = getDayGearSuggestion(day, 'pro');
    expect(gear.wear.some((item) => /short-sleeve jersey/i.test(item.label))).toBe(true);
    expect(gear.bring.some((item) => /wind vest/i.test(item.label))).toBe(true);
  });
});

describe('getWearRows', () => {
  const mockItem = (label: string): GearTipItem => ({ label, icon: 'Shirt' });

  it('handles empty input gracefully', () => {
    expect(getWearRows([], false)).toEqual([]);
    expect(getWearRows([], true)).toEqual([]);
  });

  describe('mobile (!isWide)', () => {
    it('chunks 2 items into 1 row of 2', () => {
      const items = [mockItem('1'), mockItem('2')];
      const rows = getWearRows(items, false);
      expect(rows).toEqual([[items[0], items[1]]]);
    });

    it('chunks 3 items into 2 rows (2 + 1)', () => {
      const items = [mockItem('1'), mockItem('2'), mockItem('3')];
      const rows = getWearRows(items, false);
      expect(rows).toEqual([[items[0], items[1]], [items[2]]]);
    });

    it('chunks 4 items into 2 rows (2 + 2)', () => {
      const items = [mockItem('1'), mockItem('2'), mockItem('3'), mockItem('4')];
      const rows = getWearRows(items, false);
      expect(rows).toEqual([
        [items[0], items[1]],
        [items[2], items[3]],
      ]);
    });

    it('chunks 5 items into 3 rows (2 + 2 + 1)', () => {
      const items = [mockItem('1'), mockItem('2'), mockItem('3'), mockItem('4'), mockItem('5')];
      const rows = getWearRows(items, false);
      expect(rows).toEqual([[items[0], items[1]], [items[2], items[3]], [items[4]]]);
    });
  });

  describe('desktop (isWide)', () => {
    it('keeps 1 to 4 items on a single full-width row', () => {
      const two = [mockItem('1'), mockItem('2')];
      expect(getWearRows(two, true)).toEqual([[two[0], two[1]]]);

      const three = [mockItem('1'), mockItem('2'), mockItem('3')];
      expect(getWearRows(three, true)).toEqual([[three[0], three[1], three[2]]]);

      const four = [mockItem('1'), mockItem('2'), mockItem('3'), mockItem('4')];
      expect(getWearRows(four, true)).toEqual([[four[0], four[1], four[2], four[3]]]);
    });

    it('chunks 5 items into 2 rows (3 + 2) filling 100% width on both rows', () => {
      const items = [mockItem('1'), mockItem('2'), mockItem('3'), mockItem('4'), mockItem('5')];
      const rows = getWearRows(items, true);
      expect(rows).toEqual([
        [items[0], items[1], items[2]],
        [items[3], items[4]],
      ]);
    });

    it('chunks 6 or more items into rows of 3', () => {
      const items = [
        mockItem('1'),
        mockItem('2'),
        mockItem('3'),
        mockItem('4'),
        mockItem('5'),
        mockItem('6'),
      ];
      const rows = getWearRows(items, true);
      expect(rows).toEqual([
        [items[0], items[1], items[2]],
        [items[3], items[4], items[5]],
      ]);
    });
  });
});
