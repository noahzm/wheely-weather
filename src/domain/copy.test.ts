import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLIMATE_MESSAGES,
  ALERT_MESSAGES,
  ISSUE_PHRASES,
  RIDE_LENGTH_MESSAGES,
  STATUS_MESSAGES,
  formatIssuesAsSentence,
  formatKitReason,
  formatKitTiming,
  formatVerdictDetail,
  getVerdictLabel,
  issuePhraseTier,
} from './copy';
import { getMessage } from './ride-factors';
import { getHourlyCondition } from './scoring';
import { getHourConditionReasons } from '../utils/forecastHelpers';
import { makeWeather } from '@/test-utils/weather';

describe('home climate copy', () => {
  it('names the place turning it on would use, or asks for one', () => {
    expect(CLIMATE_MESSAGES.HINT_OFF('Houston, TX')).toContain('to Houston, TX’s climate');
    expect(CLIMATE_MESSAGES.HINT_OFF(null)).toContain('Pick a place first');
  });
});

describe('verdict labels', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('puts the start time in the headline when waiting for a later window', () => {
    vi.setSystemTime(new Date(2026, 8, 24, 9, 0, 0));
    const seen = { yes: new Set<string>(), maybe: new Set<string>() };
    for (let i = 0; i < 200; i++) {
      for (const status of ['yes', 'maybe'] as const) {
        const label = getVerdictLabel(status, `Place ${i}`, '2 PM');
        expect(label).toMatch(/ 2 PM$/);
        seen[status].add(label);
      }
    }
    // Every headline in each wait pool is reachable.
    expect(seen.yes.size).toBe(4);
    expect(seen.maybe.size).toBe(3);
  });

  it('ignores the wait time on a no-go day', () => {
    vi.setSystemTime(new Date(2026, 8, 24, 9, 0, 0));
    expect(getVerdictLabel('no', 'A', '2 PM')).toBe(getVerdictLabel('no', 'A'));
  });

  it('returns a stable label for the same status and location seed', () => {
    vi.setSystemTime(new Date(2026, 6, 2, 9, 0, 0));
    expect(getVerdictLabel('yes', 'Philadelphia')).toBe(getVerdictLabel('yes', 'Philadelphia'));
  });

  it('holds the same label all day so the app and widget agree', () => {
    vi.setSystemTime(new Date(2026, 6, 2, 6, 0, 0));
    const morning = getVerdictLabel('maybe', 'Raleigh, NC');
    for (let hour = 7; hour < 24; hour++) {
      vi.setSystemTime(new Date(2026, 6, 2, hour, 30, 0));
      expect(getVerdictLabel('maybe', 'Raleigh, NC')).toBe(morning);
    }
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
    expect(ISSUE_PHRASES.GUSTS(42, 'bad')).toBe('Dangerous gusts (42 mph)');
    expect(ISSUE_PHRASES.GUSTS(36, 'poor')).toBe('Strong gusts (36 mph)');
    // The EPA's names: 201–300 is "very unhealthy", only 301+ "hazardous".
    expect(ISSUE_PHRASES.AQI(220, 'bad')).toBe('Very unhealthy air (AQI 220)');
    expect(ISSUE_PHRASES.AQI(320, 'bad')).toBe('Hazardous air (AQI 320)');
    expect(ISSUE_PHRASES.AQI(72, 'fair')).toBe('Moderate air quality (AQI 72)');
    // Cold rain above freezing isn't "freezing rain".
    expect(ISSUE_PHRASES.COLD_RAIN('38°F', '60%', 'bad')).toBe('Near-freezing rain (38°F, 60%)');
    expect(ISSUE_PHRASES.HEAT('97°F', 'bad')).toBe('Dangerous heat (97°F)');
    expect(ISSUE_PHRASES.COLD('30°F', 'bad')).toBe('Freezing (30°F)');
    expect(ISSUE_PHRASES.HUMIDITY('76°F', 'bad')).toBe('Oppressive humidity (dew 76°F)');
    expect(ISSUE_PHRASES.HUMIDITY('62°F', 'marginal')).toBe('Muggy (dew 62°F)');
    expect(ISSUE_PHRASES.AQI(160, 'poor')).toBe('Unhealthy air (AQI 160)');
    expect(ISSUE_PHRASES.AQI(120, 'marginal')).toBe('Air unhealthy for some (AQI 120)');
    expect(ISSUE_PHRASES.WIND('38 km/h', 'poor')).toBe('Very windy (38 km/h)');
    expect(ISSUE_PHRASES.GUSTS('50 km/h', 'bad')).toBe('Dangerous gusts (50 km/h)');
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
    const heroIssues = getMessage(makeWeather(weather), 'maybe').issues;
    const drawerReasons = getHourConditionReasons({
      ...weather,
      hour: 10,
      condition: getHourlyCondition({
        temperature: weather.temperature,
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

describe('formatIssuesAsSentence', () => {
  it('returns an empty string when issues list is empty', () => {
    expect(formatIssuesAsSentence([])).toBe('');
  });

  it('formats single issue and capitalizes first character', () => {
    expect(formatIssuesAsSentence(['Dangerous heat (95°F)'])).toBe('Dangerous heat (95°F).');
    expect(formatIssuesAsSentence(['fog'])).toBe('Fog.');
    expect(formatIssuesAsSentence(['light drizzle'])).toBe('Light drizzle.');
  });

  it('formats two issues with "and" and proper capitalization', () => {
    expect(formatIssuesAsSentence(['Dangerous heat (95°F)', 'Rain very likely (80%)'])).toBe(
      'Dangerous heat (95°F) and rain very likely (80%).',
    );
    expect(formatIssuesAsSentence(['fog', 'Rain very likely (80%)'])).toBe(
      'Fog and rain very likely (80%).',
    );
  });

  it('formats three or more issues as Oxford comma list with proper capitalization', () => {
    expect(formatIssuesAsSentence(['fog', 'Windy (22 mph)', 'Rain likely (60%)'])).toBe(
      'Fog, windy (22 mph), and rain likely (60%).',
    );
  });
});

describe('formatVerdictDetail', () => {
  it('describes the conditions on a ride day and the issues otherwise', () => {
    expect(formatVerdictDetail('yes', { lead: '68°F, clear.', issues: [], timing: null })).toBe(
      '68°F, clear.',
    );
    expect(
      formatVerdictDetail('maybe', { lead: 'Rideable, but:', issues: ['Breezy'], timing: null }),
    ).toBe('Breezy.');
  });

  it('leads with what’s wrong right now when waiting', () => {
    const message = { lead: 'Rideable, but:', issues: ['Breezy'], timing: null, now: 'Rain' };
    expect(formatVerdictDetail('maybe', message)).toBe('Right now: rain. Then breezy.');
    expect(
      formatVerdictDetail('maybe', { ...message, lead: 'On the edge of comfortable.', issues: [] }),
    ).toBe('Right now: rain. Then on the edge of comfortable.');
  });

  it('falls back to the lead when there is no single issue to name', () => {
    expect(
      formatVerdictDetail('no', {
        lead: STATUS_MESSAGES.THUNDERSTORM,
        issues: [],
        timing: null,
      }),
    ).toBe(STATUS_MESSAGES.THUNDERSTORM);
  });
});

describe('kit card copy', () => {
  it('says why each item is in the kit, in either unit', () => {
    expect(formatKitReason({ kind: 'cold', temperature: 46, when: 'start' }, 'fahrenheit')).toBe(
      '46° start',
    );
    expect(formatKitReason({ kind: 'cold', temperature: 50, when: 'finish' }, 'celsius')).toBe(
      '10° finish',
    );
    expect(formatKitReason({ kind: 'cold', temperature: 41, when: 'low' }, 'fahrenheit')).toBe(
      'Low of 41°',
    );
    // A swing is a difference: 18°F is 10°C, not -8°C.
    expect(formatKitReason({ kind: 'swing', degrees: 18 }, 'celsius')).toBe('10° swing');
    expect(formatKitReason({ kind: 'swing', degrees: 18 }, 'fahrenheit')).toBe('18° swing');
    expect(formatKitReason({ kind: 'rain', chance: 40 }, 'fahrenheit')).toBe('40% chance of rain');
    expect(formatKitReason({ kind: 'wetRoads' }, 'fahrenheit')).toBe('Wet roads');
    expect(formatKitReason({ kind: 'wind', speed: 17 }, 'fahrenheit')).toBe('17 mph wind');
    expect(formatKitReason({ kind: 'wind', speed: 17 }, 'celsius')).toBe('27 km/h wind');
    expect(formatKitReason({ kind: 'uv', index: 4.4 }, 'fahrenheit')).toBe('UV 4');
    expect(formatKitReason({ kind: 'muggy', dewpoint: 70 }, 'fahrenheit')).toBe('70° dew point');
  });

  it('says when a piece comes off or goes on', () => {
    expect(formatKitTiming({ kind: 'offBy', hour: 11 })).toBe('Off by 11 AM');
    expect(formatKitTiming({ kind: 'offBetween', from: 10, to: 17 })).toBe('Off 10 AM–5 PM');
    expect(formatKitTiming({ kind: 'onBy', hour: 16 })).toBe('On by 4 PM');
    expect(formatKitTiming({ kind: 'only', from: 12, to: 14 })).toBe('12 PM–2 PM only');
  });

  it('names the ride length on the card', () => {
    expect(RIDE_LENGTH_MESSAGES.CHIP(3)).toBe('3-hour ride');
    expect(RIDE_LENGTH_MESSAGES.CHIP('allDay')).toBe('All-day ride');
  });
});
