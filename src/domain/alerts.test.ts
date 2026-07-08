import { describe, expect, it } from 'vitest';
import { getWeatherAlerts } from './weather';

describe('Weather Alerts', () => {
  it('keeps the derived heat alert when the NWS alert is unrelated excessive weather', () => {
    const alerts = getWeatherAlerts({
      feelsLike: 105,
      nwsAlerts: [{ type: 'nws', event: 'Excessive Rainfall Warning' }],
    });

    expect(alerts.some((alert) => alert.type === 'heat')).toBe(true);
  });

  it('does not duplicate a heat alert when NWS already issued one', () => {
    const alerts = getWeatherAlerts({
      feelsLike: 105,
      nwsAlerts: [{ type: 'nws', event: 'Heat Advisory' }],
    });

    expect(alerts.filter((alert) => alert.type === 'heat')).toHaveLength(0);
  });

  it('does not duplicate a heat alert when WeatherKit (iOS) already issued one', () => {
    const alerts = getWeatherAlerts({
      feelsLike: 105,
      nwsAlerts: [{ type: 'weatherkit', severity: 'warning', event: 'Heat Advisory' }],
    });

    expect(alerts.filter((alert) => alert.type === 'heat')).toHaveLength(0);
  });

  it('adds a warning-level heat alert when feels like is above 95F', () => {
    const alerts = getWeatherAlerts({ feelsLike: 100 });

    expect(alerts).toContainEqual(
      expect.objectContaining({
        type: 'heat',
        severity: 'warning',
        icon: 'thermometer',
      }),
    );
    expect(alerts[0]?.message).toContain('100°F');
  });
});
