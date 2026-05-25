import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { supabase } from '../../lib/supabase';

const BG = '#FFFFFF';
const W = '#222222';
const MUTED = '#9CA3AF';
const RED = '#F4A6A6';
const INP_BG = '#FFF7F7';
const BDR = '#F1DCDC';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signInWithEmail() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password,
    });

    if (error) Alert.alert('Error al iniciar sesión', error.message);
    setLoading(false);
  }

  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.container}>
        
        <View style={s.header}>
          <Text style={s.title}>Bienvenido de nuevo</Text>
          <Text style={s.subtitle}>Inicia sesión para continuar</Text>
        </View>

        <View style={s.form}>
          <Text style={s.label}>Correo electrónico</Text>
          <TextInput
            style={s.input}
            placeholder="tu@email.com"
            placeholderTextColor={'#A1A1AA'}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={s.label}>Contraseña</Text>
          <TextInput
            style={s.input}
            placeholder="••••••••"
            placeholderTextColor={'#A1A1AA'}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Pressable style={[s.btnPrimary, loading && s.btnDisabled]} onPress={signInWithEmail} disabled={loading}>
            {loading ? <ActivityIndicator color={W} /> : <Text style={s.btnPrimaryTxt}>Entrar</Text>}
          </Pressable>

          <View style={s.footer}>
            <Text style={s.footerTxt}>¿No tienes cuenta?</Text>
            <Link href="/(auth)/register" asChild>
              <Pressable style={s.linkBtn}>
                <Text style={s.linkTxt}>Crear cuenta</Text>
              </Pressable>
            </Link>
          </View>
        </View>

      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  header: { marginBottom: 40 },
  title: { fontSize: 32, fontWeight: '800', color: W, letterSpacing: 0, marginBottom: 8 },
  subtitle: { fontSize: 15, color: MUTED },
  form: { gap: 16 },
  label: { fontSize: 13, fontWeight: '600', color: W, marginLeft: 4 },
  input: { backgroundColor: INP_BG, color: W, height: 52, borderRadius: 12, paddingHorizontal: 16, fontSize: 15, borderWidth: 1, borderColor: BDR },
  btnPrimary: { backgroundColor: RED, height: 52, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  btnDisabled: { opacity: 0.7 },
  btnPrimaryTxt: { color: W, fontSize: 15, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 32, gap: 8 },
  footerTxt: { color: MUTED, fontSize: 14 },
  linkBtn: { paddingVertical: 8 },
  linkTxt: { color: RED, fontSize: 14, fontWeight: '700' },
});
