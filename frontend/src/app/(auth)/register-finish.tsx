import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { ApiError } from '@/api/client';
import { PRODUCT_CATEGORIES } from '@/api/categories';
import { Radius, Spacing } from '@/constants/theme';
import { useRegistration } from '@/context/registration';
import { useSession } from '@/context/session';
import { useTheme } from '@/hooks/use-theme';

export default function RegisterFinishScreen() {
  const theme = useTheme();
  const { finish, clear } = useRegistration();
  const { adoptUser } = useSession();
  // Phone + interests are local-only: the backend has no field for them.
  const [phone, setPhone] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [accepted, setAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (i: string) =>
    setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));

  const onFinish = async () => {
    if (!accepted || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const user = await finish();
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
      <ScreenHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <ThemedText type="caption" themeColor="textSecondary">
            Paso 2 de 2
          </ThemedText>
          <ThemedText type="title">Casi listo</ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            Personaliza tu experiencia.
          </ThemedText>
        </View>

        <Input
          label="Teléfono"
          placeholder="+54 11 ..."
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          leading={<Icon name="call-outline" size={18} color={theme.textSecondary} />}
        />

        <View style={styles.section}>
          <ThemedText type="caption" themeColor="textSecondary">
            Categorías de interés
          </ThemedText>
          <View style={styles.interests}>
            {PRODUCT_CATEGORIES.map((i) => {
              const active = selected.includes(i);
              return (
                <Pressable
                  key={i}
                  onPress={() => toggle(i)}
                  style={[
                    styles.interest,
                    {
                      backgroundColor: active ? theme.primary : theme.cardElevated,
                      borderColor: active ? theme.primary : theme.border,
                    },
                  ]}>
                  <ThemedText
                    type="smallBold"
                    style={{ color: active ? theme.onPrimary : theme.textSecondary }}>
                    {i}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
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
        title={isSubmitting ? 'Finalizando…' : 'Finalizar registro'}
        fullWidth
        disabled={!accepted || isSubmitting}
        style={styles.cta}
        onPress={onFinish}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: Spacing.five, paddingTop: Spacing.four, paddingBottom: Spacing.six },
  head: { gap: Spacing.two },
  section: { gap: Spacing.three },
  interests: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  interest: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
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
