import { Text } from 'react-native';

import { colors } from './theme';

/** Three stars, the earned ones in gold and the rest in grey. */
export function StarRow({ stars, size }: { stars: number; size: number }) {
  return (
    <Text style={{ fontSize: size, fontWeight: '900', letterSpacing: size * 0.1 }} accessibilityLabel={`${stars} / 3 ⭐`}>
      {[0, 1, 2].map((k) => (
        <Text key={k} style={{ color: k < stars ? '#F5C33B' : colors.border }}>
          ★
        </Text>
      ))}
    </Text>
  );
}
