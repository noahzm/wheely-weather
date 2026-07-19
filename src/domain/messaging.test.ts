import { describe, expect, it } from 'vitest';
import { getMessage } from './weather';

// Flattens the structured verdict for substring assertions.
const spoken = (message: ReturnType<typeof getMessage>) =>
  [message.lead, ...message.issues, message.timing ?? ''].join(' ');

describe('Hourly Message Logic', () => {
  it('uses a natural weather phrase in the good-ride summary', () => {
    const weather = {
      hasThunderstorms: false,
      feelsLike: 68,
      windSpeed: 6,
      rainChance: 0,
      dewpoint: 50,
      aqi: 20,
      condition: 'Clear skies',
      hourly: [{ hour: 10, condition: 'good' }],
      daily: [],
    };

    const message = getMessage(weather, 'yes');
    expect(message.lead).toBe('68°F, clear skies, with light winds.');
    expect(message.issues).toEqual([]);
    expect(message.timing).toBeNull();
  });

  it('mentions when conditions become fair later even if they never reach fully good', () => {
    const weather = {
      hasThunderstorms: false,
      temperature: 33,
      windSpeed: 6,
      rainChance: 10,
      dewpoint: 50,
      aqi: 20,
      hourly: [
        { hour: 10, condition: 'bad' },
        { hour: 11, condition: 'fair' },
        { hour: 12, condition: 'fair' },
      ],
      daily: [],
    };

    expect(getMessage(weather, 'no').timing).toBe('Clears by 11 AM');
  });

  it('does not call mild weather too hot when the real issue is wind', () => {
    const weather = {
      hasThunderstorms: false,
      temperature: 70,
      windSpeed: 26, // poor sustained
      rainChance: 10,
      dewpoint: 50,
      aqi: 20,
      hourly: [{ hour: 10, condition: 'bad' }],
      daily: [],
    };

    const message = getMessage(weather, 'no');

    expect(spoken(message)).toContain('Windy (26 mph)');
    expect(spoken(message)).not.toContain('Hot (70°F)');
  });

  it('lists each issue as its own chip label with an issues lead', () => {
    const weather = {
      hasThunderstorms: false,
      temperature: 48,
      windSpeed: 13,
      rainChance: 35,
      dewpoint: 50,
      aqi: 20,
      hourly: [{ hour: 10, condition: 'fair' }],
      daily: [],
    };

    const message = getMessage(weather, 'maybe');
    expect(message.lead).toBe('Rideable, but:');
    expect(message.issues).toEqual(['Chilly (48°F)', 'Breezy (13 mph)', 'Rain possible (35%)']);
  });

  it('keeps every issue when a day stacks up many of them', () => {
    const weather = {
      hasThunderstorms: false,
      temperature: 48,
      windSpeed: 13,
      rainChance: 35,
      dewpoint: 62,
      aqi: 80,
      hourly: [{ hour: 10, condition: 'fair' }],
      daily: [],
    };

    // cold, gusty, rainy, sticky, hazy => 5 chips, no "plus N more" collapse
    expect(getMessage(weather, 'maybe').issues).toHaveLength(5);
  });

  it('phrases a single rain issue naturally', () => {
    const weather = {
      hasThunderstorms: false,
      temperature: 60,
      windSpeed: 5,
      rainChance: 32,
      dewpoint: 50,
      aqi: 20,
      hourly: [{ hour: 10, condition: 'fair' }],
      daily: [],
    };

    expect(getMessage(weather, 'maybe').issues).toEqual(['Rain possible (32%)']);
  });

  it('rounds rain chance in rider-facing copy', () => {
    const weather = {
      hasThunderstorms: false,
      temperature: 60,
      windSpeed: 5,
      rainChance: 32 + 1e-14,
      dewpoint: 50,
      aqi: 20,
      hourly: [{ hour: 10, condition: 'fair' }],
      daily: [],
    };

    expect(getMessage(weather, 'maybe').issues).toEqual(['Rain possible (32%)']);
  });

  it('names heavy rain codes when rain percentage alone looks low', () => {
    const weather = {
      hasThunderstorms: false,
      temperature: 60,
      windSpeed: 5,
      rainChance: 10,
      dewpoint: 50,
      aqi: 20,
      weatherCode: 65,
      hourly: [{ hour: 10, condition: 'poor' }],
      daily: [],
    };

    expect(spoken(getMessage(weather, 'no'))).toContain('heavy rain');
  });

  it('names snow codes when raw metrics do not explain the downgrade', () => {
    const weather = {
      hasThunderstorms: false,
      temperature: 60,
      windSpeed: 5,
      rainChance: 10,
      dewpoint: 50,
      aqi: 20,
      weatherCode: 73,
      hourly: [{ hour: 10, condition: 'marginal' }],
      daily: [],
    };

    expect(spoken(getMessage(weather, 'maybe'))).toContain('snow');
  });

  it('names fog codes when raw metrics do not explain the downgrade', () => {
    const weather = {
      hasThunderstorms: false,
      temperature: 60,
      windSpeed: 5,
      rainChance: 10,
      dewpoint: 50,
      aqi: 20,
      weatherCode: 45,
      hourly: [{ hour: 10, condition: 'fair' }],
      daily: [],
    };

    expect(spoken(getMessage(weather, 'maybe'))).toContain('fog');
  });

  it('describes gusts when they are the worse wind factor', () => {
    const weather = {
      hasThunderstorms: false,
      temperature: 60,
      windSpeed: 8, // good sustained
      windGust: 34, // poor gusts
      rainChance: 0,
      dewpoint: 50,
      aqi: 20,
      hourly: [{ hour: 10, condition: 'poor' }],
      daily: [],
    };

    expect(spoken(getMessage(weather, 'no'))).toContain('Gusty (34 mph gusts)');
  });
});
