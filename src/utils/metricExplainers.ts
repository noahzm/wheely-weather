import { THRESHOLDS, UV_GEAR, type Thresholds } from '../domain/constants';

import { fahrenheitToCelsius, formatTemperature, type TempUnit } from './temperature';

export interface MetricExplainer {
  title: string;
  summary: string;
  tip: string;
}

/**
 * What a tip needs to match the card beside it: the thresholds the cells are
 * rated with (the rider's acclimatized set) and the display unit.
 */
export interface ExplainerContext {
  thresholds: Thresholds;
  unit: TempUnit;
}

/** "58–66°F": the low end without a unit, so the range reads as one span. */
function tempRange(lowF: number, highF: number, unit: TempUnit): string {
  const low = unit === 'celsius' ? fahrenheitToCelsius(lowF) : lowF;
  return `${Math.round(low)}–${formatTemperature(highF, unit, { withUnitLabel: true })}`;
}

/** A temperature difference: 5°F is about 3°C. */
function tempDelta(lowF: number, highF: number, unit: TempUnit): string {
  if (unit === 'fahrenheit') return `${lowF}–${highF}°F`;
  return `${Math.round((lowF * 5) / 9)}–${Math.round((highF * 5) / 9)}°C`;
}

const EXPLAINERS: Record<string, (context: ExplainerContext) => MetricExplainer> = {
  'Rain Chance': () => ({
    title: 'Rain Chance',
    summary: 'Chance of rain this hour.',
    tip: 'Over 30%, pack a light shell; over 50%, a rain jacket, unless only a sprinkle is expected. Wet roads cut tire grip and painted lines get slick, so allow longer stopping distances.',
  }),
  Temperature: ({ unit }) => ({
    title: 'Temperature & Feels Like',
    summary: 'Air temperature now, and how it feels with wind and humidity.',
    tip: `Airflow at riding speed (15–20 mph) makes it feel ${tempDelta(5, 10, unit)} colder. Start slightly cool so you don’t overheat and soak your base layers once you’re riding hard.`,
  }),
  Wind: () => ({
    title: 'Wind & Gusts',
    summary: 'Sustained wind speed, compass direction, and peak gusts.',
    tip: 'Crosswind gusts over 20 mph can push deep-section rims around and unsettle the bike. Try heading into the wind on the way out so you get a tailwind home.',
  }),
  'Air Quality': ({ thresholds }) => {
    const { FAIR, MARGINAL } = thresholds.AQI;
    return {
      title: 'Air Quality Index',
      summary: 'US EPA index for fine particles and ozone.',
      tip: `Hard riding raises your breathing rate up to 10×. AQI 0–${FAIR} is ideal; ${FAIR + 1}–${MARGINAL} is fine for most riders; above ${MARGINAL}, ease off or ride indoors.`,
    };
  },
  Dewpoint: ({ thresholds, unit }) => {
    const { FAIR, MARGINAL } = thresholds.DEWPOINT;
    return {
      title: 'Dewpoint & Moisture',
      summary: 'How much moisture is in the air.',
      tip: `A better guide than relative humidity. Under ${formatTemperature(FAIR, unit, { withUnitLabel: true })} feels dry and comfortable; ${tempRange(FAIR, MARGINAL, unit)} is humid; above ${formatTemperature(MARGINAL, unit, { withUnitLabel: true })} sweat evaporates slowly, so drink more and carry electrolytes.`,
    };
  },
  'UV Index': () => ({
    title: 'UV Radiation',
    summary: 'Sunburn-causing UV intensity this hour.',
    // Same levels as the kit's sunscreen and sunglasses (UV_GEAR).
    tip: `UV ${UV_GEAR.SUNSCREEN}+ calls for sunscreen on arms, legs and the back of the neck. At 6+ skin can burn in 20–30 minutes: wear SPF 30+ or UV sleeves, and from ${UV_GEAR.SUNGLASSES} add sunglasses.`,
  }),
  Sunrise: () => ({
    title: 'Sunrise Time',
    summary: 'First daylight, and the low-sun glare that comes with it.',
    tip: 'Drivers facing a low sun can’t see you well. Run bright flashing daytime lights front and rear, and consider high-contrast lenses.',
  }),
  Sunset: () => ({
    title: 'Sunset Time',
    summary: 'Last direct daylight before twilight fades.',
    tip: 'Light drops fast after sunset. If your ride runs past dusk, use a white front light and a red taillight; many places require both by law.',
  }),
};

const DEFAULT_CONTEXT: ExplainerContext = { thresholds: THRESHOLDS, unit: 'fahrenheit' };

/** Cycling guidance for a "Right now" metric, matched to its ratings and unit. */
export function getMetricExplainer(
  label: string,
  context: ExplainerContext = DEFAULT_CONTEXT,
): MetricExplainer | null {
  return EXPLAINERS[label]?.(context) ?? null;
}
