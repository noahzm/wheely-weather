# Visual references

These are **mobile web references**, captured with WebKit using the iPhone 13
viewport (390 × 664 CSS pixels), not screenshots of the native iOS app. They
capture the current implementation for design review; Noah has not approved them
as a design specification. Native tabs, SwiftUI settings, safe-area behavior and
the widget still need native verification.

| Scenario | Light                         | Dark                         |
| -------- | ----------------------------- | ---------------------------- |
| Ride     | [Screenshot](ride-light.png)  | [Screenshot](ride-dark.png)  |
| Maybe    | [Screenshot](maybe-light.png) | [Screenshot](maybe-dark.png) |
| Rest     | [Screenshot](rest-light.png)  | [Screenshot](rest-dark.png)  |
| Alert    | [Screenshot](alert-light.png) | [Screenshot](alert-dark.png) |
| Wait     | [Screenshot](wait-light.png)  | [Screenshot](wait-dark.png)  |

## Reproduce

```bash
npx playwright install webkit   # once, or after a Playwright update
npm run build:web
npm run references:web
```

The separate Playwright configuration captures all five existing mock scenarios
in light and dark mode, with a clock starting at July 15, 2026, 11 AM in New York and advancing normally,
`en-US`, default rider settings, reduced motion, loaded fonts, collapsed drawers,
and full-page screenshots at CSS resolution. External requests are blocked, and
the temporary export server stops when capture finishes. Clock changes do not
alter system time. The pinned starting hour makes the mock content repeatable even
when today's weather changes. The clock must advance for Reanimated layout to
settle; capture waits for chart positioning and two matching screenshot frames.

Ordinary tests and CI never regenerate these files. Run this command only when
intending to update the references, inspect the resulting images, and review the
changes along with the UI change. The capture configuration always updates the images; it does not gate normal
tests on a pixel comparison. These are review aids:
WebKit versions, fonts and OS rendering can affect pixels. The floating nav
remains at the bottom of the first viewport in these full-page captures. Capture native iOS
references separately when the simulator or a device is available.
