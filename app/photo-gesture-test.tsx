import { Link } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const BG = '#FFF8FB';
const CARD = '#FFFFFF';
const BORDER = '#F1D7E2';
const TEXT = '#4C2A3D';
const TEXT_SOFT = '#8E6D7D';
const ACCENT = '#E88CAF';
const SAMPLE_SIZE = 210;

export default function PhotoGestureTestScreen() {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .onBegin(() => {
      panStartX.value = translateX.value;
      panStartY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = panStartX.value + event.translationX;
      translateY.value = panStartY.value + event.translationY;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <SafeAreaView style={s.safeArea} edges={['top', 'bottom']}>
      <View style={s.screen}>
        <View style={s.header}>
          <Text style={s.title}>Gesture Setup Test</Text>
          <Text style={s.subtitle}>This screen only tests whether a simple drag gesture works.</Text>
          <Link href="/(tabs)/notes" style={s.link}>
            Volver a Notas
          </Link>
        </View>

        <View style={s.stage}>
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[s.square, animatedStyle]} />
          </GestureDetector>
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>If this square does not move, the gesture setup is still broken.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG,
  },
  screen: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  header: {
    alignItems: 'center',
    gap: 6,
    marginBottom: 18,
  },
  title: {
    color: TEXT,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subtitle: {
    color: TEXT_SOFT,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 320,
  },
  link: {
    marginTop: 4,
    color: ACCENT,
    fontSize: 14,
    fontWeight: '700',
  },
  stage: {
    flex: 1,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#FFFDFE',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  square: {
    width: SAMPLE_SIZE,
    height: SAMPLE_SIZE,
    borderRadius: 28,
    backgroundColor: '#F8DCE8',
    borderWidth: 1,
    borderColor: '#E7B8CC',
    shadowColor: 'rgba(107, 57, 83, 0.16)',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 1,
    shadowRadius: 22,
    elevation: 8,
  },
  footer: {
    marginTop: 16,
    alignItems: 'center',
  },
  footerText: {
    color: TEXT_SOFT,
    fontSize: 12,
    textAlign: 'center',
  },
});
