export interface MetricExplainer {
  title: string;
  summary: string;
  tip: string;
}

const EXPLAINERS: Record<string, MetricExplainer> = {
  'Rain Chance': {
    title: 'Rain Chance',
    summary: 'Probability of precipitation during your ride window.',
    tip: 'Over 30% warrants a packable rain jacket or vest. Wet tarmac reduces tire traction and painted lines become slick; allow longer stopping distances.',
  },
  Temperature: {
    title: 'Temperature & Feels Like',
    summary: 'Ambient air temperature versus apparent thermal comfort.',
    tip: 'Airflow at riding speed (15–20 mph) increases wind chill by 5–10°F. Start slightly cool so you do not overheat and soak your base layers once riding at tempo.',
  },
  Wind: {
    title: 'Wind & Gusts',
    summary: 'Sustained wind speed, compass direction, and peak gusts.',
    tip: 'Crosswind gusts over 20 mph can catch deep aero carbon rims and compromise bike stability. Try routing into the headwind on the way out to catch a tailwind home.',
  },
  'Air Quality': {
    title: 'Air Quality Index',
    summary: 'Outdoor particulate matter (PM2.5 / ozone) measure.',
    tip: 'Aerobic cycling multiplies ventilation rate up to 10×. AQI 0–50 is ideal; 51–100 is acceptable for most; 101+ warrants easing intensity or riding indoors.',
  },
  Dewpoint: {
    title: 'Dewpoint & Moisture',
    summary: 'Absolute atmospheric moisture measurement.',
    tip: 'More predictive than relative humidity for riders. Under 58°F feels dry and comfortable; 58–66°F is humid; above 66°F sweat evaporates slowly, so drink more and carry electrolytes.',
  },
  'UV Index': {
    title: 'UV Radiation',
    summary: 'Sunburn-producing ultraviolet intensity at peak solar angle.',
    tip: 'UV 3–5 warrants sunscreen on arms, legs, and back of the neck; UV 6+ increases burn risk in 20–30 min—wear SPF 30+, UV sleeves or jersey, and UV cycling lenses.',
  },
  Sunrise: {
    title: 'Sunrise Time',
    summary: 'First daylight and low-angle sun glare window.',
    tip: 'Low sun angles blind motorists looking into the sunrise. Run high-lumen flashing daytime running lights (front and rear) and consider high-contrast lenses.',
  },
  Sunset: {
    title: 'Sunset Time',
    summary: 'Last direct daylight before twilight fades.',
    tip: 'Light drops rapidly after sunset. If your ride runs past dusk, use a white front light and a red taillight; many places require both by law.',
  },
};

/** Returns cycling-specific guidance and contextual tip for a ride spec metric label. */
export function getMetricExplainer(label: string): MetricExplainer | null {
  return EXPLAINERS[label] ?? null;
}
