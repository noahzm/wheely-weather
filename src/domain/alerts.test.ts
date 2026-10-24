import { describe, expect, it } from 'vitest';
import { resolveThresholds } from './acclimatization';
import { THRESHOLDS } from './constants';
import { getOverallStatus, getWeatherAlerts } from './weather';
import { makeWeather } from '@/test-utils/weather';

// Heat index from air temperature and dew point: 96°F with a 74°F dew point is
// 108°F, 90°F with a 74°F dew point is 99°F.
const scorching = { temperature: 96, dewpoint: 74 };
const muggy = { temperature: 90, dewpoint: 74 };

describe('Weather Alerts', () => {
  it('keeps the derived heat alert when the NWS alert is unrelated excessive weather', () => {
    const alerts = getWeatherAlerts(
      makeWeather({
        ...scorching,
        nwsAlerts: [{ type: 'nws', severity: 'warning', event: 'Excessive Rainfall Warning' }],
      }),
    );

    expect(alerts.some((alert) => alert.type === 'heat')).toBe(true);
  });

  it('does not duplicate a heat alert when NWS already issued one', () => {
    const alerts = getWeatherAlerts(
      makeWeather({
        ...scorching,
        nwsAlerts: [{ type: 'nws', severity: 'warning', event: 'Heat Advisory' }],
      }),
    );

    expect(alerts.filter((alert) => alert.type === 'heat')).toHaveLength(0);
  });

  it('does not duplicate a heat alert when WeatherKit (iOS) already issued one', () => {
    const alerts = getWeatherAlerts(
      makeWeather({
        ...scorching,
        nwsAlerts: [{ type: 'weatherkit', severity: 'warning', event: 'Heat Advisory' }],
      }),
    );

    expect(alerts.filter((alert) => alert.type === 'heat')).toHaveLength(0);
  });

  it('adds a warning-level heat alert from a 96°F heat index', () => {
    const alerts = getWeatherAlerts(makeWeather(muggy));

    expect(alerts).toContainEqual(
      expect.objectContaining({
        type: 'heat',
        severity: 'warning',
        icon: 'thermometer',
      }),
    );
    expect(alerts[0]?.message).toContain('Heat index 99°F');
  });

  it('does not add a heat alert under a 96°F heat index', () => {
    const alerts = getWeatherAlerts(makeWeather({ temperature: 90, dewpoint: 60 }));
    expect(alerts.filter((alert) => alert.type === 'heat')).toHaveLength(0);
  });

  it('goes extreme from 103°F, where the rating’s hazard makes it a no-go', () => {
    const weather = makeWeather({ temperature: 94, dewpoint: 74 });
    const [alert] = getWeatherAlerts(weather);
    expect(alert).toMatchObject({ type: 'heat', severity: 'extreme' });
    expect(alert?.message).toContain('Heat index 105°F');
    const gulfRider = resolveThresholds(
      { warmTemp: 95, warmDewpoint: 76, coolTemp: 60 },
      THRESHOLDS,
      'high',
    );
    expect(getOverallStatus(weather, gulfRider)).toBe('no');
  });

  it('reads the heat index, not the provider’s feels-like', () => {
    const alerts = getWeatherAlerts(makeWeather({ temperature: 80, dewpoint: 60, feelsLike: 110 }));
    expect(alerts).toHaveLength(0);
  });

  it('falls back to the air temperature without a dew point', () => {
    const alerts = getWeatherAlerts(
      makeWeather({ temperature: 104, dewpoint: null as unknown as number }),
    );
    expect(alerts[0]?.severity).toBe('extreme');
  });

  it('handles alerts with undefined event safely', () => {
    const alerts = getWeatherAlerts(
      makeWeather({
        ...muggy,
        nwsAlerts: [{ type: 'nws', severity: 'warning', headline: 'Some Notice' }],
      }),
    );
    expect(alerts.some((alert) => alert.type === 'heat')).toBe(true);
  });
});
