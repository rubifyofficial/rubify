import React, { useEffect, useRef } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { Camera, Plus, Mic, Send } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { CustomStickerIcon } from '../icons/CustomStickerIcon';

const COMPOSER_BG = '#FFF8FA';
const COMPOSER_SURFACE = '#FFFDFE';
const COMPOSER_BORDER = '#F1DDE3';

type ComposerThemeColors = {
  containerBackground?: string;
  surfaceBackground?: string;
  borderColor?: string;
  inputTextColor?: string;
  placeholderTextColor?: string;
  mutedIconColor?: string;
  sendButtonColor?: string;
  recordingSurface?: string;
  recordingTextColor?: string;
  recordingMutedTextColor?: string;
};

interface MessagesComposerProps {
  inputText: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onCameraPress?: () => void;
  onPlusPress?: () => void;
  onStickerPress?: () => void;
  onVoicePress?: () => void;
  inputRef?: React.RefObject<TextInput | null>;
  onInputFocus?: () => void;
  isPanelOpen?: boolean;
  onInputPressWhenPanelOpen?: () => void;
  isRecording?: boolean;
  recordingSeconds?: number;
  onCancelRecording?: () => void;
  onSendRecording?: () => void;
  bottomInset: number;
  themeColors?: ComposerThemeColors;
}

export function MessagesComposer({
  inputText,
  onChangeText,
  onSend,
  onCameraPress,
  onPlusPress,
  onStickerPress,
  onVoicePress,
  inputRef,
  onInputFocus,
  isPanelOpen = false,
  onInputPressWhenPanelOpen,
  isRecording = false,
  recordingSeconds = 0,
  onCancelRecording,
  onSendRecording,
  bottomInset,
  themeColors,
}: MessagesComposerProps) {
  const hasText = inputText.trim().length > 0;

  const showCamera = !hasText;
  const showSend = hasText;

  const cameraAnim = useRef(new Animated.Value(showCamera ? 1 : 0)).current;

  const cameraWidth = cameraAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 40],
  });
  const cameraOpacity = cameraAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const cameraScale = cameraAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1],
  });
  const cameraGap = cameraAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 2],
  });

  useEffect(() => {
    Animated.timing(cameraAnim, {
      toValue: showCamera ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [cameraAnim, showCamera]);

  const formatSeconds = (seconds: number) => {
    const clamped = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
    const mm = Math.floor(clamped / 60);
    const ss = clamped % 60;
    return `${mm}:${String(ss).padStart(2, '0')}`;
  };

  const containerBackground = themeColors?.containerBackground ?? COMPOSER_BG;
  const surfaceBackground = themeColors?.surfaceBackground ?? COMPOSER_SURFACE;
  const borderColor = themeColors?.borderColor ?? COMPOSER_BORDER;
  const inputTextColor = themeColors?.inputTextColor ?? Colors.light.text;
  const placeholderTextColor = themeColors?.placeholderTextColor ?? Colors.light.textMuted;
  const mutedIconColor = themeColors?.mutedIconColor ?? Colors.light.textMuted;
  const sendButtonColor = themeColors?.sendButtonColor ?? Colors.light.tint;
  const recordingSurface = themeColors?.recordingSurface ?? '#F6EEF1';
  const recordingTextColor = themeColors?.recordingTextColor ?? Colors.light.text;
  const recordingMutedTextColor = themeColors?.recordingMutedTextColor ?? Colors.light.textMuted;

  return (
    <View style={[styles.outerContainer, { paddingBottom: Math.max(bottomInset, 10), backgroundColor: containerBackground, borderColor }]}>
      <View style={[styles.composerBar, { backgroundColor: surfaceBackground, borderColor }]}>
        {isRecording ? (
          <View style={styles.recordingRow}>
            <Pressable style={[styles.recordingBtn, { backgroundColor: recordingSurface }]} onPress={onCancelRecording}>
              <Text style={[styles.recordingBtnText, { color: recordingMutedTextColor }]}>Cancelar</Text>
            </Pressable>
            <View style={styles.recordingCenter}>
              <Text style={[styles.recordingLabel, { color: recordingMutedTextColor }]}>Grabando...</Text>
              <Text style={[styles.recordingTime, { color: recordingTextColor }]}>{formatSeconds(recordingSeconds)}</Text>
            </View>
            <Pressable style={[styles.recordingBtn, styles.recordingSendBtn, { backgroundColor: sendButtonColor }]} onPress={onSendRecording}>
              <Text style={[styles.recordingBtnText, styles.recordingSendText]}>Enviar</Text>
            </Pressable>
          </View>
        ) : (
          <>
        <Animated.View
          style={[
            styles.cameraSlot,
            {
              width: cameraWidth,
              marginRight: cameraGap,
              opacity: cameraOpacity,
              transform: [{ scale: cameraScale }],
            },
          ]}
        >
          <Pressable style={styles.iconButton} onPress={onCameraPress}>
            <Camera size={20} color={mutedIconColor} />
          </Pressable>
        </Animated.View>

        <Pressable style={styles.iconButton} onPress={onPlusPress}>
          <Plus size={20} color={mutedIconColor} />
        </Pressable>

        <View style={styles.inputWrapper}>
          <TextInput
            ref={inputRef}
            style={[styles.textInput, { color: inputTextColor }]}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={placeholderTextColor}
            value={inputText}
            onChangeText={onChangeText}
            onFocus={onInputFocus}
            multiline
            editable={!isPanelOpen}
          />
          {isPanelOpen ? (
            <Pressable
              style={StyleSheet.absoluteFillObject}
              onPress={onInputPressWhenPanelOpen}
            />
          ) : null}
        </View>

        <Pressable style={styles.iconButton} onPress={onStickerPress}>
          <CustomStickerIcon size={24} opacity={0.65} />
        </Pressable>

        {showSend ? (
          <Pressable style={[styles.iconButton, styles.sendButton, { backgroundColor: sendButtonColor }]} onPress={onSend}>
            <Send size={18} color="#FFF" />
          </Pressable>
        ) : (
          <Pressable style={styles.iconButton} onPress={onVoicePress}>
            <Mic size={20} color={mutedIconColor} />
          </Pressable>
        )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    backgroundColor: COMPOSER_BG,
    borderTopWidth: 1,
    borderColor: COMPOSER_BORDER,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  composerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COMPOSER_SURFACE,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COMPOSER_BORDER,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  cameraSlot: {
    height: 40,
    overflow: 'hidden',
  },
  textInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    color: Colors.light.text,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 40,
    maxHeight: 100,
  },
  inputWrapper: {
    flex: 1,
    minWidth: 0,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButton: {
    backgroundColor: Colors.light.tint,
  },
  recordingRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 8,
  },
  recordingCenter: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  recordingLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.textMuted,
  },
  recordingTime: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.light.text,
  },
  recordingBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#F6EEF1',
  },
  recordingSendBtn: {
    backgroundColor: Colors.light.tint,
  },
  recordingBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.textMuted,
  },
  recordingSendText: {
    color: '#fff',
  },
});
