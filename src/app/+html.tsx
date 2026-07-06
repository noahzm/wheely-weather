import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

const APPEARANCE_KEY = 'ww_appearance';

const themeBootstrapScript = `(function(){try{var p=localStorage.getItem('${APPEARANCE_KEY}');var d=p==='dark'||(p!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var b=d?'#000000':'#ffffff';document.documentElement.style.setProperty('--wheely-background',b);document.documentElement.style.colorScheme=d?'dark':'light';document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){}})();`;

export default function Root({ children }: Readonly<PropsWithChildren>) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta property="og:title" content="Wheely Weather" />
        <meta
          property="og:description"
          content="Scores how good today's weather is for a bike ride — hourly forecast, kit guide, and a plain-language ride verdict."
        />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Wheely Weather" />
        <meta
          name="twitter:description"
          content="Scores how good today's weather is for a bike ride — hourly forecast, kit guide, and a plain-language ride verdict."
        />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
