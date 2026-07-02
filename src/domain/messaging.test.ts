import { describe, expect, it } from 'vitest';
import { getMessage } from './weather';

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
    };

    expect(getMessage(weather, 'yes')).toBe(
      'Ideal ride conditions. 68°F, clear skies, and light winds.',
    );
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
    };

    expect(getMessage(weather, 'no')).toContain('Clears by 11am');
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
    };

    const message = getMessage(weather, 'no');

    expect(message).toContain('heavy wind');
    expect(message).not.toContain('too hot (70°F)');
  });

  it('lists up to three issues inline as a readable sentence', () => {
    const weather = {
      hasThunderstorms: false,
      temperature: 48,
      windSpeed: 13,
      rainChance: 35,
      dewpoint: 50,
      aqi: 20,
      hourly: [{ hour: 10, condition: 'fair' }],
    };

    expect(getMessage(weather, 'maybe')).toBe(
      'Rideable. But it\u2019s cold (48°F), gusty (13 mph), and rainy (35% chance).',
    );
  });

  it('caps a wall of issues to the two most relevant with a "plus N more" tail', () => {
    const weather = {
      hasThunderstorms: false,
      temperature: 48,
      windSpeed: 13,
      rainChance: 35,
      dewpoint: 62,
      aqi: 80,
      hourly: [{ hour: 10, condition: 'fair' }],
    };

    // cold, gusty, rainy, sticky, hazy => 5 issues, collapsed to 2 + "plus 3 more"
    expect(getMessage(weather, 'maybe')).toBe(
      'Rideable. But it\u2019s cold (48°F) and gusty (13 mph), plus 3 more.',
    );
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
    };

    expect(getMessage(weather, 'maybe')).toBe('Rideable. But it\u2019s rainy (32% chance).');
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
    };

    expect(getMessage(weather, 'no')).toContain('heavy rain');
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
    };

    expect(getMessage(weather, 'maybe')).toContain('snow');
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
    };

    expect(getMessage(weather, 'maybe')).toContain('fog');
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
    };

    expect(getMessage(weather, 'no')).toContain('strong gusts (34 mph gusts)');
  });
});
