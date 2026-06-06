import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { ApiError } from '@/api/client';
import { Spacing } from '@/constants/theme';
import { useRegistration } from '@/context/registration';
import { useTheme } from '@/hooks/use-theme';

export default function RegisterAccountScreen() {
  const theme = useTheme();
  const { submitStep1 } = useRegistration();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    domicilio: '',
    pais: 'Argentina',
  });
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    form.name.trim().length > 0 &&
    form.email.trim().length > 0 &&
    form.password.length >= 8 &&
    form.domicilio.trim().length > 0 &&
    form.pais.trim().length > 0 &&
    !isSubmitting;

  const onContinue = async () => {
    if (!canSubmit) return;
    setError(null);
    setIsSubmitting(true);
    try {
      // etapa-1 requires nombre + apellido separately. Split the single
      // "Nombre completo" field on the first space; fall back to '.' so the
      // backend always receives a non-empty apellido.
      const fullName = form.name.trim();
      const firstSpace = fullName.indexOf(' ');
      const nombre = firstSpace === -1 ? fullName : fullName.slice(0, firstSpace);
      const apellido = firstSpace === -1 ? '.' : fullName.slice(firstSpace + 1).trim() || '.';

      await submitStep1({
        nombre,
        apellido,
        email: form.email.trim(),
        password: form.password,
        domicilio: form.domicilio.trim(),
        pais: form.pais.trim(),
      });
      router.push('/(auth)/register-finish');
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : 'No se pudo crear la cuenta. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen padded>
      <ScreenHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <ThemedText type="caption" themeColor="textSecondary">
            Paso 1 de 2
          </ThemedText>
          <ThemedText type="title">Crea tu cuenta</ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            Datos básicos para empezar.
          </ThemedText>
        </View>

        <View style={styles.form}>
          <Input
            label="Nombre completo"
            placeholder="Tu nombre"
            value={form.name}
            onChangeText={(v) => {
              set('name')(v);
              if (error) setError(null);
            }}
            leading={<Icon name="person-outline" size={18} color={theme.textSecondary} />}
          />
          <Input
            label="Email"
            placeholder="tu@email.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={form.email}
            onChangeText={(v) => {
              set('email')(v);
              if (error) setError(null);
            }}
            leading={<Icon name="mail-outline" size={18} color={theme.textSecondary} />}
          />
          <Input
            label="Contraseña"
            placeholder="Mínimo 8 caracteres"
            secureTextEntry
            value={form.password}
            onChangeText={set('password')}
            leading={<Icon name="lock-closed-outline" size={18} color={theme.textSecondary} />}
          />
          <Input
            label="Domicilio"
            placeholder="Calle 123, Ciudad"
            value={form.domicilio}
            onChangeText={set('domicilio')}
            leading={<Icon name="home-outline" size={18} color={theme.textSecondary} />}
          />
          <Input
            label="País"
            placeholder="Argentina"
            value={form.pais}
            onChangeText={set('pais')}
            leading={<Icon name="globe-outline" size={18} color={theme.textSecondary} />}
          />

          {error ? (
            <ThemedText type="small" style={{ color: theme.danger }}>
              {error}
            </ThemedText>
          ) : null}
        </View>
      </ScrollView>

      <Button
        title={isSubmitting ? 'Creando…' : 'Continuar'}
        fullWidth
        disabled={!canSubmit}
        style={styles.cta}
        onPress={onContinue}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.six, paddingTop: Spacing.four, paddingBottom: Spacing.six },
  head: { gap: Spacing.two },
  form: { gap: Spacing.four },
  cta: { marginBottom: Spacing.four },
});
