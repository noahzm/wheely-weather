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
  halfWrap: {
    position: 'relative',
  },
  halfClip: {
    position: 'absolute',
    top: 0,
    left: 0,
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

/** An outlined/empty star glyph: native SF Symbol on iOS, lucide elsewhere. */
function EmptyStar({ size, color }: Readonly<{ size: number; color: string }>) {
  return Platform.OS === 'ios' ? (
    <SymbolView name="star" size={size} tintColor={color} />
  ) : (
    <Star size={size} color={color} fill="none" strokeWidth={1.5} />
  );
}

/**
 * One star of the rating (full, half, or empty).
 * A half star renders the left half filled and the right half outlined.
 */
function RatingStar({
  fill,
  size,
  filledColor,
  emptyColor,
}: Readonly<{
  fill: StarFill;
  size: number;
  filledColor: string;
  emptyColor: string;
}>) {
  if (fill === 'empty') {
    return <EmptyStar size={size} color={emptyColor} />;
  }
  if (fill === 'half') {
    return Platform.OS === 'ios' ? (
      <SymbolView name="star.leadinghalf.filled" size={size} tintColor={filledColor} />
    ) : (
      <View style={[styles.halfWrap, { width: size, height: size }]}>
        <Star size={size} color={emptyColor} fill="none" strokeWidth={1.5} />
        <View style={[styles.halfClip, { width: size / 2, height: size }]}>
          <Star size={size} color={filledColor} fill={filledColor} strokeWidth={2} />
        </View>
      </View>
    );
  }
  return <SolidStar sfSymbol="star.fill" size={size} color={filledColor} />;
}

/** 0–5 star rating in half-star steps; displays all 5 stars for consistent baseline. */
export function StarRating({
  rating,
  size = 24,
  color,
  emptyColor,
}: Readonly<{ rating: number; size?: number; color?: string; emptyColor?: string }>) {
  const c = useWheelyColors();
  const starColor = color ?? c.ink;
  const starEmptyColor = emptyColor ?? c.border;
  const stars = Array.from({ length: STAR_COUNT }, (_, i) => starFillAt(i, rating));
  return (
    <View style={styles.row} accessible={true} accessibilityLabel={`${rating} out of 5 stars`}>
      {stars.map((fill, i) => (
        <RatingStar
          key={i}
          fill={fill}
          size={size}
          filledColor={starColor}
          emptyColor={starEmptyColor}
        />
      ))}
    </View>
  );
}
