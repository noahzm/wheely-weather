import { Image as ReactNativeImage, type ImageProps } from 'react-native';

export function Image(props: Readonly<ImageProps>) {
  return <ReactNativeImage {...props} />;
}

export default Image;
