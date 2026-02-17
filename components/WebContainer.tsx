import React from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import Colors from '@/constants/colors';

interface WebContainerProps {
  children: React.ReactNode;
  maxWidth?: number;
}

function WebContainerInner({ children, maxWidth = 640 }: WebContainerProps) {
  const { width } = useWindowDimensions();

  if (Platform.OS !== 'web' || width < maxWidth + 40) {
    return <>{children}</>;
  }

  return (
    <View style={styles.outer}>
      <View style={[styles.inner, { maxWidth }]}>
        {children}
      </View>
    </View>
  );
}

export default React.memo(WebContainerInner);

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  inner: {
    flex: 1,
    width: '100%' as any,
  },
});
