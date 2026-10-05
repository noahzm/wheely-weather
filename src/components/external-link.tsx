import { Href, Link } from 'expo-router';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { type ComponentProps } from 'react';

import { isSafeExternalUrl } from '@/utils/url';

type Props = Omit<ComponentProps<typeof Link>, 'href'> & { href: string };

// Unsafe URLs render as an inert link; '#' isn't a route, so typed routes need the cast.
const BLOCKED_HREF = '#' as Href;

export function ExternalLink({ href, ...rest }: Props) {
  const isSafe = isSafeExternalUrl(href);

  return (
    <Link
      target="_blank"
      rel="noopener noreferrer"
      {...rest}
      href={isSafe ? href : BLOCKED_HREF}
      onPress={(event) => {
        if (!isSafe) {
          event.preventDefault();
          return;
        }
        if (process.env.EXPO_OS !== 'web') {
          // Prevent the default behavior of linking to the default browser on native.
          event.preventDefault();
          // Open the link in an in-app browser.
          void openBrowserAsync(href, {
            presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
          });
        }
      }}
    />
  );
}
