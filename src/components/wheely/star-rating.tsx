import { Platform, StyleSheet, View } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Star } from 'lucide-react-native';

import { useWheelyColors } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { starFillAt, STAR_COUNT, type StarFill } from '@/utils/starRating';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  halfClip: {
    overflow: 'hidden',
  },
});

/** A solid star glyph: native SF Symbol on iOS, lucide elsewhere. */
function SolidStar({
  sfSymbol,
  size,
  color,
}: Readonly<{ sfSymbol: SFSymbol; size: number; color: string }>) {
  return Platform.OS === 'ios' ? (
    <SymbolView name={sfSymbol} size={size} tintColor={color} />
  ) : (
    <Star size={size} color={color} fill={color} strokeWidth={2} />
  );
}

/**
 * One earned star of the rating. A half star renders as the filled left half
 * alone: SF Symbols ships a fill-only half variant for exactly this, while
 * lucide's StarHalf is only a half outline, so on the web/Android side a
 * solid star is clipped to half width instead.
 */
function RatingStar({
  fill,
  size,
  filledColor,
}: Readonly<{
  fill: Exclude<StarFill, 'empty'>;
  size: number;
  filledColor: string;
}>) {
  if (fill === 'half') {
    return Platform.OS === 'ios' ? (
      <SymbolView name="star.leadinghalf.filled" size={size} tintColor={filledColor} />
    ) : (
      <View style={[styles.halfClip, { width: size / 2, height: size }]}>
        <Star size={size} color={filledColor} fill={filledColor} strokeWidth={2} />
      </View>
    );
  }
  return <SolidStar sfSymbol="star.fill" size={size} color={filledColor} />;
}

/** Earned stars of a 0–5 rating in half-star steps; empty stars are omitted. */
export function StarRating({ rating, size = 24 }: Readonly<{ rating: number; size?: number }>) {
  const c = useWheelyColors();
  const earned = Array.from({ length: STAR_COUNT }, (_, i) => starFillAt(i, rating)).filter(
    (fill): fill is Exclude<StarFill, 'empty'> => fill !== 'empty',
  );
  return (
    <View style={styles.row}>
      {earned.map((fill, i) => (
        <RatingStar key={i} fill={fill} size={size} filledColor={c.warning} />
      ))}
    </View>
  );
}
