module.exports = () => ({
  expo: {
    name: 'Usfully',
    slug: 'app_temp',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'apptemp',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    splash: {
      image: './assets/images/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      permissions: [
        'CAMERA',
        'RECORD_AUDIO',
        'MODIFY_AUDIO_SETTINGS',
        'ACCESS_NETWORK_STATE',
        'BLUETOOTH_CONNECT',
        'READ_MEDIA_IMAGES',
        'READ_MEDIA_VIDEO',
        'READ_EXTERNAL_STORAGE',
        'WRITE_EXTERNAL_STORAGE',
      ],
      package: 'com.usfully.app_temp',
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
      },
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      [
        'expo-camera',
        {
          cameraPermission: 'Usfully necesita acceso a la cámara para crear momentos.',
          microphonePermission: 'Usfully necesita acceso al micrófono para grabar videos.',
          recordAudioAndroid: true,
        },
      ],
      'expo-audio',
      [
        'expo-media-library',
        {
          photosPermission: 'Usfully necesita acceso a tus fotos para guardar momentos.',
          savePhotosPermission: 'Usfully necesita permiso para guardar momentos en tu galería.',
          isAccessMediaLocationEnabled: true,
        },
      ],
      'expo-video',
      'expo-notifications',
      'expo-router',
      [
        '@stream-io/video-react-native-sdk',
        {
          androidPictureInPicture: false,
        },
      ],
      [
        '@config-plugins/react-native-webrtc',
        {
          cameraPermission: 'Usfully necesita acceso a la cámara para ver juntos.',
          microphonePermission: 'Usfully necesita acceso al micrófono para hablar mientras ven juntos.',
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: 'b545c888-8e55-41ae-b5db-fc0873872517',
      },
    },
  },
});
