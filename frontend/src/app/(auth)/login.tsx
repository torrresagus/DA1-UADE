import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BidifyMark } from '@/components/ui/bidify-mark';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { AuthError, useSession } from '@/context/session';
import { useTheme } from '@/hooks/use-theme';

export default function LoginScreen() {
  const theme = useTheme();
  const { login } = useSession();
  const [email, setEmail] = useState('');
  // Password is cosmetic: the backend has no auth, login resolves the user by
  // email only. We still require it non-empty in the form for UX parity.
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
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
      setError(e instanceof AuthError ? e.message : 'No se pudo iniciar sesión. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen padded>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.brand}>
            <BidifyMark size={88} />
            <ThemedText type="title">Bienvenido de Nuevo</ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.center}>
              Inicia sesión para seguir pujando
            </ThemedText>
          </View>

          <View style={styles.form}>
            <Input
              label="Email"
              placeholder="tu@email.com"
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
              label="Contraseña"
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
            <Pressable style={styles.forgot}>
              <ThemedText type="link" style={{ color: theme.primary }}>
                ¿Olvidaste tu contraseña?
              </ThemedText>
            </Pressable>

            {error ? (
              <ThemedText type="small" style={{ color: theme.danger }}>
                {error}
              </ThemedText>
            ) : null}

            <Button
              title={isSubmitting ? 'Ingresando…' : 'Iniciar sesión'}
              fullWidth
              disabled={!canSubmit}
              onPress={onLogin}
            />
          </View>

          <View style={styles.footer}>
            <ThemedText type="small" themeColor="textSecondary">
              ¿No tienes cuenta?
            </ThemedText>
            <Pressable onPress={() => router.push('/(auth)/register-account')}>
              <ThemedText type="link" style={{ color: theme.primary }}>
                Crear cuenta
              </ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', gap: Spacing.six, paddingVertical: Spacing.six },
  brand: { alignItems: 'center', gap: Spacing.three },
  center: { textAlign: 'center' },
  form: { gap: Spacing.four },
  forgot: { alignSelf: 'flex-end' },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two },
});
