/**
 * US region abbreviation helpers.
 *
 * MapKit search labels arrive pre-abbreviated ("Iowa City, IA"), but the
 * Nominatim reverse geocoder names device locations with the full state
 * ("San Francisco, California"). Abbreviating at the geocoder keeps every
 * location label in the compact MapKit style.
 */

const US_STATE_ABBREVIATIONS: Readonly<Record<string, string>> = {
  Alabama: 'AL',
  Alaska: 'AK',
  Arizona: 'AZ',
  Arkansas: 'AR',
  California: 'CA',
  Colorado: 'CO',
  Connecticut: 'CT',
  Delaware: 'DE',
  'District of Columbia': 'DC',
  Florida: 'FL',
  Georgia: 'GA',
  Hawaii: 'HI',
  Idaho: 'ID',
  Illinois: 'IL',
  Indiana: 'IN',
  Iowa: 'IA',
  Kansas: 'KS',
  Kentucky: 'KY',
  Louisiana: 'LA',
  Maine: 'ME',
  Maryland: 'MD',
  Massachusetts: 'MA',
  Michigan: 'MI',
  Minnesota: 'MN',
  Mississippi: 'MS',
  Missouri: 'MO',
  Montana: 'MT',
  Nebraska: 'NE',
  Nevada: 'NV',
  'New Hampshire': 'NH',
  'New Jersey': 'NJ',
  'New Mexico': 'NM',
  'New York': 'NY',
  'North Carolina': 'NC',
  'North Dakota': 'ND',
  Ohio: 'OH',
  Oklahoma: 'OK',
  Oregon: 'OR',
  Pennsylvania: 'PA',
  'Rhode Island': 'RI',
  'South Carolina': 'SC',
  'South Dakota': 'SD',
  Tennessee: 'TN',
  Texas: 'TX',
  Utah: 'UT',
  Vermont: 'VT',
  Virginia: 'VA',
  Washington: 'WA',
  'West Virginia': 'WV',
  Wisconsin: 'WI',
  Wyoming: 'WY',
};

/** USPS abbreviation for a full state name; anything else passes through unchanged. */
export function abbreviateUSState(state: string): string {
  return US_STATE_ABBREVIATIONS[state] ?? state;
}

/**
 * Rewrites a "City, Full State" label to "City, ST", matching on an exact US
 * state name only — a trailing segment that is not an exact match (a country,
 * an abbreviation, a foreign region) is left alone.
 */
export function abbreviateTrailingUSState(label: string): string {
  const comma = label.lastIndexOf(', ');
  if (comma === -1) return label;
  const region = label.slice(comma + 2);
  const abbr = US_STATE_ABBREVIATIONS[region];
  return abbr ? `${label.slice(0, comma)}, ${abbr}` : label;
}
