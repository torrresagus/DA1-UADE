import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { RegisterSteps } from '@/components/register-steps';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useRegistration } from '@/context/registration';
import { useSession } from '@/context/session';
import { useTheme } from '@/hooks/use-theme';

export default function RegisterFinishScreen() {
  const theme = useTheme();
  const { draft, finish, clear } = useRegistration();
  const { adoptUser } = useSession();
  // Etapa-2: the bidder sets their personal password after the external
  // verification of etapa-1 (per the enunciado).
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [secure, setSecure] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordsMatch = password.length > 0 && password === confirm;
  const canSubmit = password.length >= 8 && passwordsMatch && accepted && !isSubmitting;

  const onFinish = async () => {
    if (!canSubmit) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const user = await finish(password);
      await adoptUser(user);
      clear();
      router.replace('/(tabs)/home');
    } catch (e) {
      // A 409 that survives the auto-approve shim means the account is still in
      // review; surface the backend detail otherwise.
      setError(
        e instanceof ApiError
          ? e.status === 409
            ? 'Tu registro está en revisión.'
            : e.detail
          : 'No se pudo finalizar el registro. Intenta de nuevo.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen padded>
      <ScreenHeader title="CREAR CUENTA" rightIcon="notifications-outline" />
      <RegisterSteps current={3} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <ThemedText type="title">Generá tu clave personal</ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            {draft
              ? `${draft.nombre}, tu identidad fue verificada. Definí la contraseña para acceder a tu cuenta.`
              : 'Definí la contraseña para acceder a tu cuenta.'}
          </ThemedText>
        </View>

        <View style={styles.form}>
          <Input
            label="Contraseña"
            placeholder="Mínimo 8 caracteres"
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
          <Input
            label="Confirmar contraseña"
            placeholder="Repetí tu contraseña"
            secureTextEntry={secure}
            value={confirm}
            onChangeText={setConfirm}
            leading={<Icon name="lock-closed-outline" size={18} color={theme.textSecondary} />}
          />
          {confirm.length > 0 && !passwordsMatch ? (
            <ThemedText type="small" style={{ color: theme.danger }}>
              Las contraseñas no coinciden.
            </ThemedText>
          ) : null}
        </View>

        <Pressable style={styles.terms} onPress={() => setAccepted((a) => !a)}>
          <View
            style={[
              styles.checkbox,
              {
                backgroundColor: accepted ? theme.primary : 'transparent',
                borderColor: accepted ? theme.primary : theme.borderStrong,
              },
            ]}>
            {accepted ? <Icon name="checkmark" size={14} color={theme.onPrimary} /> : null}
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            Acepto los términos y la política de privacidad de Bidify.
          </ThemedText>
        </Pressable>

        {error ? (
          <ThemedText type="small" style={{ color: theme.danger }}>
            {error}
          </ThemedText>
        ) : null}
      </ScrollView>

      <Button
        title={isSubmitting ? 'Finalizando…' : 'FINALIZAR REGISTRO'}
        fullWidth
        disabled={!canSubmit}
        style={styles.cta}
        onPress={onFinish}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: Spacing.five, paddingTop: Spacing.five, paddingBottom: Spacing.six },
  head: { gap: Spacing.two },
  form: { gap: Spacing.four },
  terms: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: { marginBottom: Spacing.four },
});
