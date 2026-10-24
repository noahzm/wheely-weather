declare module '*.css' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '*.woff2' {
  const source: string;
  export default source;
}

declare module '*.otf' {
  const source: string;
  export default source;
}

// Metro turns an imported image into an asset reference for an Image source.
declare module '*.png' {
  import type { ImageSourcePropType } from 'react-native';

  const source: ImageSourcePropType;
  export default source;
}
