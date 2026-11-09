import React from 'react';
import { Pressable, type PressableProps } from 'react-native';
import { hapticLight } from '@/lib/haptics';

export const HapticPressable = React.forwardRef<any, PressableProps>(function HapticPressable(
  { onPress, ...rest },
  ref,
) {
  return (
    <Pressable
      ref={ref}
      {...rest}
      onPress={(event) => {
        hapticLight();
        onPress?.(event);
      }}
    />
  );
});