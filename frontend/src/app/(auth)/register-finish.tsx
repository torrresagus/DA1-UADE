import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { getUsuario } from '@/api/endpoints/usuarios';
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

type ApprovalState = 'checking' | 'pending' | 'approved';

export default function RegisterFinishScreen() {
  const theme = useTheme();
  const { draft, finish, clear } = useRegistration();
  const { adoptUser } = useSession();

  const [approvalState, setApprovalState] = useState<ApprovalState>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [secure, setSecure] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkApproval = async () => {
    if (!draft) {
      setApprovalState('pending');
      return;
    }
    setApprovalState('checking');
    try {
      const user = await getUsuario(draft.usuarioId);
      if (user.estado_registro === 'aprobado_fase_1' || user.estado_registro === 'completo') {
        setApprovalState('approved');
      } else {
        setApprovalState('pending');
      }
    } catch {
      setApprovalState('pending');
    }
  };

  useEffect(() => {
    checkApproval();
  }, [draft]);

  useEffect(() => {
    if (approvalState !== 'pending') return;
    const interval = setInterval(checkApproval, 5000);
    return () => clearInterval(interval);
  }, [approvalState]);

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

  const renderContent = () => {
    if (approvalState === 'checking') {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText type="default" themeColor="textSecondary" style={styles.centerText}>
            Verificando estado de tu solicitud…
          </ThemedText>
        </View>
      );
    }

    if (approvalState === 'pending') {
      return (
        <View style={styles.centered}>
          <View style={[styles.iconCircle, { backgroundColor: theme.cardElevated }]}>
            <Icon name="time-outline" size={48} color={theme.primary} />
          </View>
          <ThemedText type="title" style={styles.centerText}>
            Registro en revisión
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.centerText}>
            Tus datos están siendo verificados por el equipo de Bidify. Una vez aprobada tu
            solicitud, volvé a esta pantalla para crear tu contraseña.
          </ThemedText>
          {draft?.email ? (
            <ThemedText type="small" themeColor="textSecondary" style={[styles.centerText, styles.hint]}>
              Te enviamos un email a{' '}
              <ThemedText type="smallBold">{draft.email}</ThemedText>
              {' '}con las instrucciones para continuar.
            </ThemedText>
          ) : null}
          <ThemedText type="small" themeColor="textMuted" style={[styles.centerText, styles.hint]}>
            La aprobación es realizada manualmente por la empresa. Para consultas, contactá a
            soporte.
          </ThemedText>
          <Button
            title="Verificar estado"
            fullWidth
            onPress={checkApproval}
            style={styles.checkBtn}
          />
          <Pressable onPress={() => router.replace('/(auth)/login')}>
            <ThemedText type="link" style={{ color: theme.primary }}>
              Volver al inicio de sesión
            </ThemedText>
          </Pressable>
        </View>
      );
    }

    return (
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

        <Button
          title={isSubmitting ? 'Finalizando…' : 'FINALIZAR REGISTRO'}
          fullWidth
          disabled={!canSubmit}
          style={styles.cta}
          onPress={onFinish}
        />
      </ScrollView>
    );
  };

  return (
    <Screen padded>
      <ScreenHeader
        title="CREAR CUENTA"
        fallbackRoute="/(auth)/register-account"
        rightIcon="notifications-outline"
      />
      <RegisterSteps current={approvalState === 'approved' ? 3 : 2} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {renderContent()}
      </KeyboardAvoidingView>
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    paddingVertical: Spacing.six,
  },
  centerText: { textAlign: 'center' },
  hint: { paddingHorizontal: Spacing.four },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtn: { marginTop: Spacing.two },
});
