import { Tabs } from 'expo-router';
import { Home, Image as ImageIcon, BookHeart, MessageCircle, MapPin, Calendar } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_BG = '#FFFFFF';
const BORDER = '#F1DCDC';
const ACTIVE = '#F4A6A6';
const INACTIVE = '#9CA3AF';

// Tab bar height above the safe area
const TAB_ICON_AREA = 56; // icon + label

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = TAB_ICON_AREA + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          backgroundColor: TAB_BG,
          borderTopWidth: 1,
          borderTopColor: BORDER,
          height: tabBarHeight,
          paddingBottom: insets.bottom + 4,
          paddingTop: 8,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0,
          marginTop: 2,
        },
      }}>

      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="moments"
        options={{
          title: 'Momentos',
          tabBarIcon: ({ color, size }) => <ImageIcon size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ubicacion"
        options={{
          title: 'Ubicación',
          tabBarIcon: ({ color, size }) => <MapPin size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Mensajes',
          tabBarIcon: ({ color, size }) => <MessageCircle size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendario"
        options={{
          title: 'Calendario',
          tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} />,
        }}
      />

      {/* Hidden but routable routes */}
      <Tabs.Screen
        name="notes"
        options={{
          href: null,
          title: 'Notas',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
          title: 'Perfil',
        }}
      />
    </Tabs>
  );
}
