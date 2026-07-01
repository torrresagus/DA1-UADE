import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { ThemedText } from '@/components/themed-text';
import { BidifyMark } from '@/components/ui/bidify-mark';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';
import { useTheme } from '@/hooks/use-theme';

export default function LoginScreen() {
  const theme = useTheme();
  const { login, enterGuestMode } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [remember, setRemember] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isSubmitting;

  const onLogin = async () => {
    if (!canSubmit) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)/home');
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : 'No se pudo iniciar sesión. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen padded>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.brand}>
            <BidifyMark size={88} />
            <ThemedText type="title" style={styles.wordmark}>
              BIDIFY
            </ThemedText>
            <ThemedText type="caption" themeColor="textSecondary" style={styles.tagline}>
              ELITE ASSET TRADING PLATFORM
            </ThemedText>
          </View>

          <View style={styles.headline}>
            <ThemedText type="heading" style={styles.center}>
              Bienvenido de Nuevo
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.center}>
              Acceda a su cartera de activos premium
            </ThemedText>
          </View>

          <View style={styles.form}>
            <Input
              label="CORREO ELECTRÓNICO"
              placeholder="nombre@luxe.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                if (error) setError(null);
              }}
              leading={<Icon name="mail-outline" size={18} color={theme.textSecondary} />}
            />
            <Input
              label="CONTRASEÑA"
              placeholder="••••••••"
              secureTextEntry={secure}
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                if (error) setError(null);
              }}
              leading={<Icon name="lock-closed-outline" size={18} color={theme.textSecondary} />}
              trailing={
                <Pressable onPress={() => setSecure((s) => !s)}>
                  <Icon
                    name={secure ? 'eye-outline' : 'eye-off-outline'}
                    size={18}
                    color={theme.textSecondary}
                  />
                </Pressable>
              }
            />
            <View style={styles.metaRow}>
              <Pressable style={styles.remember} onPress={() => setRemember((r) => !r)}>
                <View
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: remember ? theme.primary : 'transparent',
                      borderColor: remember ? theme.primary : theme.borderStrong,
                    },
                  ]}>
                  {remember ? <Icon name="checkmark" size={12} color={theme.onPrimary} /> : null}
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  Recordarme
                </ThemedText>
              </Pressable>
              <Pressable>
                <ThemedText type="link" style={{ color: theme.primary }}>
                  ¿Olvidaste tu contraseña?
                </ThemedText>
              </Pressable>
            </View>

            {error ? (
              <ThemedText type="small" style={{ color: theme.danger }}>
                {error}
              </ThemedText>
            ) : null}

            <Button
              title={isSubmitting ? 'Ingresando…' : 'INICIAR SESIÓN'}
              fullWidth
              disabled={!canSubmit}
              onPress={onLogin}
            />
          </View>

          <View style={styles.footer}>
            <ThemedText type="small" themeColor="textSecondary">
              ¿No tiene una cuenta de inversor?
            </ThemedText>
            <Pressable onPress={() => router.push('/(auth)/register-account')}>
              <ThemedText type="link" style={{ color: theme.primary }}>
                Solicitar Registro
              </ThemedText>
            </Pressable>
          </View>
          <Pressable
            onPress={async () => { await enterGuestMode(); router.replace('/(tabs)/home'); }}
            style={styles.guestLink}>
            <ThemedText type="small" themeColor="textMuted">
              Continuar como invitado
            </ThemedText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', gap: Spacing.five, paddingVertical: Spacing.six },
  brand: { alignItems: 'center', gap: Spacing.two },
  wordmark: { letterSpacing: 3 },
  tagline: { letterSpacing: 2 },
  headline: { gap: Spacing.one },
  center: { textAlign: 'center' },
  form: { gap: Spacing.four },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  remember: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two },
  guestLink: { alignItems: 'center', paddingVertical: Spacing.two },
});
