import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ALERT_MESSAGES,
  ISSUE_PHRASES,
  STATUS_MESSAGES,
  getVerdictLabel,
  issuePhraseTier,
} from './copy';
import { getMessage } from './ride-factors';
import { getHourlyCondition } from './scoring';
import { getHourConditionReasons } from '../utils/forecastHelpers';

describe('verdict labels', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns a stable label for the same status and location seed', () => {
    vi.setSystemTime(new Date(2026, 6, 2, 9, 0, 0));
    expect(getVerdictLabel('yes', 'Philadelphia')).toBe(getVerdictLabel('yes', 'Philadelphia'));
  });

  it('returns a non-empty label for every status', () => {
    vi.setSystemTime(new Date(2026, 6, 2, 9, 0, 0));
    expect(getVerdictLabel('yes', 'A')).not.toBe('');
    expect(getVerdictLabel('maybe', 'A')).not.toBe('');
    expect(getVerdictLabel('no', 'A')).not.toBe('');
  });

  it('does not reuse the hero opener phrase as a no-status badge label', () => {
    const locations = ['Philadelphia', 'A', 'B', 'Berlin', 'Sydney'];
    for (let day = 1; day <= 28; day++) {
      for (let hour = 0; hour < 24; hour++) {
        vi.setSystemTime(new Date(2026, 6, day, hour, 0, 0));
        for (const location of locations) {
          expect(getVerdictLabel('no', location)).not.toBe('Sit this one out');
        }
      }
    }
  });

  it('never hedges a no-status badge label', () => {
    const locations = ['Philadelphia', 'A', 'B', 'Berlin', 'Sydney'];
    for (let day = 1; day <= 28; day++) {
      for (let hour = 0; hour < 24; hour++) {
        vi.setSystemTime(new Date(2026, 6, day, hour, 0, 0));
        for (const location of locations) {
          expect(getVerdictLabel('no', location)).not.toBe('Probably shouldn’t');
        }
      }
    }
  });
});

describe('status messaging helpers', () => {
  it('formats rain and alert copy with dynamic values', () => {
    expect(STATUS_MESSAGES.LATER_GOOD('6 PM')).toContain('6 PM');
    expect(STATUS_MESSAGES.CLEAR_UP('7 PM')).toContain('7 PM');
    expect(ALERT_MESSAGES.HEAT_EXTREME('109°F')).toContain('109°F');
    expect(ALERT_MESSAGES.HEAT_WARNING('98°F')).toContain('98°F');
  });
});

describe('shared issue phrases', () => {
  it('varies phrasing by severity tier', () => {
    // Wording is calibrated to the numeric band, so each tier reads a step
    // stronger than the one below it (24 mph is marginal, not "Breezy").
    expect(ISSUE_PHRASES.WIND(32, 'bad')).toBe('Dangerous wind (32 mph)');
    expect(ISSUE_PHRASES.WIND(27, 'poor')).toBe('Very windy (27 mph)');
    expect(ISSUE_PHRASES.WIND(16, 'marginal')).toBe('Windy (16 mph)');
    expect(ISSUE_PHRASES.WIND(12, 'fair')).toBe('Breezy (12 mph)');
    expect(ISSUE_PHRASES.RAIN('80%', 'bad')).toBe('Rain expected (80%)');
    expect(ISSUE_PHRASES.RAIN('70%', 'poor')).toBe('Rain very likely (70%)');
    expect(ISSUE_PHRASES.RAIN('45%', 'marginal')).toBe('Rain likely (45%)');
    expect(ISSUE_PHRASES.RAIN('25%', 'fair')).toBe('Rain possible (25%)');
    expect(ISSUE_PHRASES.GUSTS(42, 'bad')).toBe('Dangerous gusts (42 mph gusts)');
    expect(ISSUE_PHRASES.GUSTS(36, 'poor')).toBe('Strong gusts (36 mph gusts)');
    expect(ISSUE_PHRASES.AQI(220, 'bad')).toBe('Hazardous air (AQI 220)');
    expect(ISSUE_PHRASES.HEAT('97°F', 'bad')).toBe('Dangerous heat (97°F)');
    expect(ISSUE_PHRASES.COLD('30°F', 'bad')).toBe('Freezing (30°F)');
    expect(ISSUE_PHRASES.HUMIDITY('76°F', 'bad')).toBe('Oppressive humidity (dew 76°F)');
    expect(ISSUE_PHRASES.HUMIDITY('62°F', 'marginal')).toBe('Muggy (dew 62°F)');
    expect(ISSUE_PHRASES.AQI(160, 'poor')).toBe('Poor air (AQI 160)');
    expect(ISSUE_PHRASES.AQI(80, 'marginal')).toBe('Hazy (AQI 80)');
  });

  it('maps a rating to its tier verbatim, and good to no issue', () => {
    expect(issuePhraseTier('good')).toBeNull();
    expect(issuePhraseTier('fair')).toBe('fair');
    expect(issuePhraseTier('marginal')).toBe('marginal');
    expect(issuePhraseTier('poor')).toBe('poor');
    expect(issuePhraseTier('bad')).toBe('bad');
  });

  // Regression: the hero collapsed fair->marginal via its own local mapping while
  // the hourly drawer passed the rating through, so a fair-rated metric was
  // "Chilly"/"Muggy"/"Hot" in one surface and "Cool"/"Humid"/"Warm" in the other.
  it('keeps the fair tier distinct from marginal where the wording differs', () => {
    expect(ISSUE_PHRASES.COLD('48°F', 'fair')).toBe('Cool (48°F)');
    expect(ISSUE_PHRASES.COLD('48°F', 'marginal')).toBe('Chilly (48°F)');
    expect(ISSUE_PHRASES.HEAT('75°F', 'fair')).toBe('Warm (75°F)');
    expect(ISSUE_PHRASES.HEAT('75°F', 'marginal')).toBe('Hot (75°F)');
    expect(ISSUE_PHRASES.HUMIDITY('62°F', 'fair')).toBe('Humid (dew 62°F)');
    expect(ISSUE_PHRASES.HUMIDITY('62°F', 'marginal')).toBe('Muggy (dew 62°F)');
  });
});

// The two issue-phrase surfaces must describe identical weather with identical
// severity words. Both route through `issuePhraseTier`, so this pins them
// together at the output level rather than trusting they still share it. Only
// the severity word is compared: the hero renders "85°F" and the drawer "85°",
// which is an intentional density difference, not a vocabulary one.
const severityWords = (phrases: string[]) => phrases.map((p) => p.split(' (')[0]);

describe('hero and hourly drawer phrasing agree', () => {
  it.each([
    ['fair-rated cold', { temperature: 48, feelsLike: 48, windSpeed: 5, windGust: null }],
    ['fair-rated heat', { temperature: 75, feelsLike: 75, windSpeed: 5, windGust: null }],
    ['marginal-rated heat', { temperature: 85, feelsLike: 85, windSpeed: 5, windGust: null }],
    // Gust 30 lands in the marginal band; a bad-tier gust would make the real
    // status 'no', where the hero lists only bad/poor and the comparison is moot.
    ['gust-driven wind', { temperature: 65, feelsLike: 65, windSpeed: 8, windGust: 30 }],
  ])('%s', (_label, metrics) => {
    const weather = { ...metrics, rainChance: 0, dewpoint: 62, weatherCode: 0, aqi: 20 };

    // 'maybe' is the branch that includes fair- and marginal-rated metrics,
    // which is exactly where the two surfaces used to diverge.
    const heroIssues = getMessage(
      { ...weather, hasThunderstorms: false, hourly: [], daily: [] },
      'maybe',
    ).issues;
    const drawerReasons = getHourConditionReasons({
      ...weather,
      hour: 10,
      condition: getHourlyCondition({
        temperature: weather.temperature,
        feelsLike: weather.feelsLike,
        wind: weather.windSpeed,
        gust: weather.windGust,
        rain: weather.rainChance,
        code: weather.weatherCode,
        dewpoint: weather.dewpoint,
      }),
    });

    expect(heroIssues.length).toBeGreaterThan(0);
    // The hero reports a subset (it filters by status); every severity word it
    // does emit must also be the drawer's word for that metric.
    for (const word of severityWords(heroIssues)) {
      expect(severityWords(drawerReasons)).toContain(word);
    }
  });
});
