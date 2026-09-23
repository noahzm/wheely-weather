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

- The Wheely Weather iOS app (latest TestFlight build).
- The web app at [wheelyweather.app](https://wheelyweather.app).
- The Cloudflare Worker that serves the site and proxies geocoding (`/api/geocode/*`).

Out of scope: the third-party services the app reads from (Apple WeatherKit and MapKit, Open-Meteo, Nominatim, the US National Weather Service). Report issues in those to their providers.

## Response process

1. The maintainer triages the report and confirms scope and impact.
2. A fix is prepared and validated.
3. The issue is disclosed once a fix is released.

Best-effort response targets:

- Acknowledgement within 3 business days.
- A status update within 7 business days after that.

## Supported versions

Only the latest release is supported: the current TestFlight build and the live site, both built from `main`.
