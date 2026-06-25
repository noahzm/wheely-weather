import { Image as ReactNativeImage, type ImageProps } from 'react-native';

export function Image(props: ImageProps) {
  return <ReactNativeImage {...props} />;
}

export default Image;

