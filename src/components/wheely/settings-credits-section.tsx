// Data-source credits for the default (web / Android) settings screen. iOS
// renders its own native Credits section in settings-form.ios.tsx; this mirrors
// it: one link row per source and the attribution sentence as the footer.
import { Linking, Platform } from 'react-native';

import { GroupedLinkRow, GroupedSection } from './grouped-list';

// Open-Meteo (CC BY 4.0) and OpenStreetMap (ODbL) both require attribution,
// and WeatherKit requires the Apple Weather mark linked to Apple's legal page.
// Web forecasts come from WeatherKit (Open-Meteo is the fallback); Android
// uses Open-Meteo only.
const isWeb = Platform.OS === 'web';

const CREDITS = [
  ...(isWeb
    ? [{ name: 'Apple Weather', url: 'https://weatherkit.apple.com/legal-attribution.html' }]
    : []),
  { name: 'Open-Meteo', url: 'https://open-meteo.com/' },
  { name: 'OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright' },
  { name: 'National Weather Service', url: 'https://www.weather.gov/' },
];

const FOOTER = isWeb
  ? 'Apple Weather provides forecasts and alerts. Air quality and backup forecasts by Open-Meteo.com (CC BY 4.0). Place search by OpenStreetMap (ODbL). Backup US alerts from the National Weather Service.'
  : 'Forecasts and air quality by Open-Meteo.com (CC BY 4.0). Place search by OpenStreetMap (ODbL). US alerts from the National Weather Service.';

export function CreditsSection() {
  return (
    <GroupedSection title="Credits" footer={FOOTER}>
      {CREDITS.map(({ name, url }) => (
        <GroupedLinkRow
          key={name}
          label={name}
          external
          onPress={() => {
            Linking.openURL(url).catch(() => {
              /* courtesy link; ignore failures */
            });
          }}
        />
      ))}
    </GroupedSection>
  );
}
