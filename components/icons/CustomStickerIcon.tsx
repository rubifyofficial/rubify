import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

interface CustomStickerIconProps {
  size?: number;
  opacity?: number;
}

const STICKER_ICON = require('../../assets/icons/custom-sticker-icon.png');

export function CustomStickerIcon({
  size = 24,
  opacity = 0.65,
}: CustomStickerIconProps) {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Image
        source={STICKER_ICON}
        style={{ width: size, height: size, opacity }}
        resizeMode="contain"
        fadeDuration={0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
