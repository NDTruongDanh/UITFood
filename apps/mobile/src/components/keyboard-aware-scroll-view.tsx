import React, { forwardRef, useEffect, useState } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  type ScrollViewProps,
  type ViewStyle,
} from 'react-native';

interface KeyboardAwareScrollViewProps extends ScrollViewProps {
  keyboardBottomOffset?: number;
}

function getBottomPadding(style: ScrollViewProps['contentContainerStyle']) {
  const flattened = StyleSheet.flatten(style) as ViewStyle | undefined;
  const paddingBottom = flattened?.paddingBottom;
  const paddingVertical = flattened?.paddingVertical;
  const padding = flattened?.padding;

  if (typeof paddingBottom === 'number') return paddingBottom;
  if (typeof paddingVertical === 'number') return paddingVertical;
  if (typeof padding === 'number') return padding;

  return 0;
}

export const KeyboardAwareScrollView = forwardRef<
  ScrollView,
  KeyboardAwareScrollViewProps
>(function KeyboardAwareScrollView(
  {
    contentContainerStyle,
    keyboardBottomOffset = 24,
    keyboardShouldPersistTaps = 'handled',
    ...props
  },
  ref,
) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;

    const showSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const adjustedContentContainerStyle =
    Platform.OS === 'android' && keyboardHeight > 0
      ? [
          contentContainerStyle,
          {
            paddingBottom:
              getBottomPadding(contentContainerStyle) +
              keyboardHeight +
              keyboardBottomOffset,
          },
        ]
      : contentContainerStyle;

  return (
    <ScrollView
      ref={ref}
      contentContainerStyle={adjustedContentContainerStyle}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      {...props}
    />
  );
});
