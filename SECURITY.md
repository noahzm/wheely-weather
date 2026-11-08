# Security Policy

## Reporting a vulnerability

Report security issues privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability** ([direct link](https://github.com/noahzm/wheely-weather/security/advisories/new)). Only the maintainer can see the report.

Please don't open public issues or pull requests for suspected vulnerabilities.

Include:

- A description of the issue and the affected part of the app.
- Steps to reproduce, or a proof of concept.
- The impact you expect, and any fix you'd suggest.

## Scope

In scope:

- The Wheely Weather iOS app (latest App Store release).
- The web app at [wheelyweather.app](https://wheelyweather.app).
- The Cloudflare Worker API behind the site (`/api/forecast`, `/api/geocode/*`).

Out of scope: the third-party services the app reads from (Apple WeatherKit and MapKit, Open-Meteo, Nominatim, the US National Weather Service). Report issues in those to their providers.

## Response process

1. The maintainer triages the report and confirms scope and impact.
2. A fix is prepared and validated.
3. The issue is disclosed once a fix is released.

Best-effort response targets:

- Acknowledgement within 3 business days.
- A status update within 7 business days after that.

## Supported versions

Only the latest release is supported: the current App Store release and the live site, both built from `main`.

## Dependency audit exceptions

Reviewed November 7, 2026 after aligning Expo SDK 58 dependencies. The remaining
audit findings are in build and lint tooling, with no identified path from rider
input to the affected APIs:

- `uuid@8` through `@bacons/xcode`: the dependency is declared but not imported.
- `deepmerge` through `@expo/config`: merges local build configuration.
- `glob` ([GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4)):
  Apple-target config plugins, Expo CLI/fingerprinting and Sentry source-map bundling.
  These traverse local project files; the app and Worker do not accept glob patterns.
- `minimatch` ([GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)):
  the same build tooling plus ESLint rules and TypeScript parser project discovery.
  Patterns come from local configuration, not weather/location requests.

The SDK update removed the earlier vulnerable Zod path and the `glob` dependency
from `expo-updates`. The remaining fixes for `glob` and `minimatch` cross major
versions, so do not force them into their parents with blanket overrides. Prefer
compatible upstream releases and recheck these paths on each dependency sweep.
Do not use `npm audit fix --force`, which proposes incompatible toolchain downgrades.
