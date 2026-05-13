import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { supabase } from '../../lib/supabase';

const BG = '#0C0C0C';
const W = '#FFFFFF';
const MUTED = '#A1A1AA';
const RED = '#EF233C';
const INP_BG = '#1C1C1E';
const BDR = '#2E2E2E';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signUpWithEmail() {
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Error', 'El nombre es requerido');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password,
      options: {
        data: { full_name: name.trim() }
      }
    });

    if (error) {
      Alert.alert('Error al registrarse', error.message);
    } else if (data.session) {
      // Auto login successful
    } else {
      Alert.alert('Registro exitoso', 'Por favor revisa tu correo electrónico para verificar tu cuenta.');
    }
    setLoading(false);
  }

  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          
          <View style={s.header}>
            <Text style={s.title}>Comenzar</Text>
            <Text style={s.subtitle}>Crea una cuenta para ti y tu pareja</Text>
          </View>

          <View style={s.form}>
            <Text style={s.label}>Nombre</Text>
            <TextInput
              style={s.input}
              placeholder="Tu nombre"
              placeholderTextColor={MUTED}
              value={name}
              onChangeText={setName}
            />

            <Text style={s.label}>Correo electrónico</Text>
            <TextInput
              style={s.input}
              placeholder="tu@email.com"
              placeholderTextColor={MUTED}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Text style={s.label}>Contraseña</Text>
            <TextInput
              style={s.input}
              placeholder="••••••••"
              placeholderTextColor={MUTED}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <Text style={s.label}>Confirmar contraseña</Text>
            <TextInput
              style={s.input}
              placeholder="••••••••"
              placeholderTextColor={MUTED}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />

            <Pressable style={[s.btnPrimary, loading && s.btnDisabled]} onPress={signUpWithEmail} disabled={loading}>
              {loading ? <ActivityIndicator color={W} /> : <Text style={s.btnPrimaryTxt}>Registrarme</Text>}
            </Pressable>

            <View style={s.footer}>
              <Text style={s.footerTxt}>Ya tengo cuenta</Text>
              <Link href="/(auth)/login" asChild>
                <Pressable style={s.linkBtn}>
                  <Text style={s.linkTxt}>Iniciar sesión</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
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
