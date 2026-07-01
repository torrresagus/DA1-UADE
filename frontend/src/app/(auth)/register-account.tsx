import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { pickAndUploadAsync } from '@/api/upload';
import { ScreenHeader } from '@/components/screen-header';
import { RegisterSteps } from '@/components/register-steps';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useRegistration } from '@/context/registration';
import { useTheme } from '@/hooks/use-theme';

const PAISES = [
  'Argentina',
  'Brasil',
  'Chile',
  'Uruguay',
  'Paraguay',
  'Bolivia',
  'Perú',
  'Colombia',
  'México',
  'Estados Unidos',
  'España',
  'Italia',
  'Francia',
  'Reino Unido',
  'Otro',
];

export default function RegisterAccountScreen() {
  const theme = useTheme();
  const { submitStep1 } = useRegistration();
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    domicilio: '',
    email: '',
  });
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const [pais, setPais] = useState('');
  const [paisOpen, setPaisOpen] = useState(false);
  const [dniFrente, setDniFrente] = useState<string | null>(null);
  const [dniDorso, setDniDorso] = useState<string | null>(null);
  const [validacion, setValidacion] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    form.nombre.trim().length > 0 &&
    form.apellido.trim().length > 0 &&
    form.email.trim().length > 0 &&
    form.domicilio.trim().length > 0 &&
    pais.length > 0 &&
    !!dniFrente &&
    !!dniDorso &&
    validacion &&
    !isSubmitting;

  const onContinue = async () => {
    if (!canSubmit) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await submitStep1({
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        email: form.email.trim(),
        domicilio: form.domicilio.trim(),
        pais,
        docFrenteUrl: dniFrente,
        docDorsoUrl: dniDorso,
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
      <ScreenHeader title="CREAR CUENTA" fallbackRoute="/(auth)/login" rightIcon="notifications-outline" />
      <RegisterSteps current={1} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.row}>
          <View style={styles.col}>
            <Input
              label="Nombre"
              placeholder="John"
              value={form.nombre}
              onChangeText={(v) => {
                set('nombre')(v);
                if (error) setError(null);
              }}
            />
          </View>
          <View style={styles.col}>
            <Input
              label="Apellido"
              placeholder="Doe"
              value={form.apellido}
              onChangeText={set('apellido')}
            />
          </View>
        </View>

        <View style={styles.field}>
          <ThemedText type="caption" themeColor="textSecondary" style={styles.label}>
            Foto DNI
          </ThemedText>
          <View style={styles.row}>
            <DniSlot label="FRENTE" uri={dniFrente} onPicked={setDniFrente} onError={setError} />
            <DniSlot label="DORSO" uri={dniDorso} onPicked={setDniDorso} onError={setError} />
          </View>
        </View>

        <Input
          label="Domicilio Legal"
          placeholder="Calle 123, Piso 4"
          value={form.domicilio}
          onChangeText={set('domicilio')}
          trailing={<Icon name="location-outline" size={18} color={theme.textSecondary} />}
        />

        <View style={styles.field}>
          <ThemedText type="caption" themeColor="textSecondary" style={styles.label}>
            País de Origen
          </ThemedText>
          <Pressable
            onPress={() => setPaisOpen(true)}
            style={[styles.select, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}>
            <ThemedText type="default" style={{ color: pais ? theme.text : theme.textMuted }}>
              {pais || 'Seleccione su país'}
            </ThemedText>
            <Icon name="chevron-down" size={18} color={theme.textSecondary} />
          </Pressable>
        </View>

        <Input
          label="Dirección de email"
          placeholder="ejemplo@correo.com"
          autoCapitalize="none"
          keyboardType="email-address"
          value={form.email}
          onChangeText={(v) => {
            set('email')(v);
            if (error) setError(null);
          }}
          trailing={<Icon name="mail-outline" size={18} color={theme.textSecondary} />}
        />

        <Pressable
          onPress={() => setValidacion((v) => !v)}
          style={[styles.consent, { borderColor: theme.border, backgroundColor: theme.card }]}>
          <View
            style={[
              styles.checkbox,
              {
                backgroundColor: validacion ? theme.primary : 'transparent',
                borderColor: validacion ? theme.primary : theme.borderStrong,
              },
            ]}>
            {validacion ? <Icon name="checkmark" size={14} color={theme.onPrimary} /> : null}
          </View>
          <View style={styles.flex}>
            <ThemedText type="smallBold">VALIDACIÓN EXTERNA</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Acepto el envío de mis datos para verificación biométrica y legal mediante proveedores
              externos de seguridad financiera.
            </ThemedText>
          </View>
        </Pressable>

        {error ? (
          <ThemedText type="small" style={{ color: theme.danger }}>
            {error}
          </ThemedText>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={isSubmitting ? 'Enviando…' : 'CONTINUAR REGISTRO'}
          fullWidth
          disabled={!canSubmit}
          onPress={onContinue}
        />
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          Al continuar, aceptas nuestros{' '}
          <ThemedText type="small" style={{ color: theme.primary }}>
            Términos y Condiciones
          </ThemedText>
          .
        </ThemedText>
      </View>
      </KeyboardAvoidingView>

      <Modal visible={paisOpen} transparent animationType="fade" onRequestClose={() => setPaisOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPaisOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ThemedText type="heading" style={styles.sheetTitle}>
              País de Origen
            </ThemedText>
            <ScrollView showsVerticalScrollIndicator={false}>
              {PAISES.map((p) => {
                const active = p === pais;
                return (
                  <Pressable
                    key={p}
                    onPress={() => {
                      setPais(p);
                      setPaisOpen(false);
                    }}
                    style={[styles.option, { borderBottomColor: theme.border }]}>
                    <ThemedText type="default" style={{ color: active ? theme.primary : theme.text }}>
                      {p}
                    </ThemedText>
                    {active ? <Icon name="checkmark" size={18} color={theme.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function DniSlot({
  label,
  uri,
  onPicked,
  onError,
}: {
  label: string;
  uri: string | null;
  onPicked: (url: string) => void;
  onError: (msg: string) => void;
}) {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const filled = !!uri;

  const pick = async () => {
    setLoading(true);
    try {
      const url = await pickAndUploadAsync();
      if (url) onPicked(url);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'No se pudo subir la imagen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Pressable
      onPress={loading ? undefined : pick}
      style={[
        styles.dni,
        {
          borderColor: filled ? theme.primary : theme.borderStrong,
          backgroundColor: filled ? theme.primaryGlow : theme.card,
        },
      ]}>
      {filled ? (
        <Image source={{ uri }} style={styles.dniImage} contentFit="cover" />
      ) : null}
      <Icon
        name={filled ? 'checkmark-circle' : loading ? 'cloud-upload-outline' : 'camera-outline'}
        size={26}
        color={filled ? theme.primary : theme.textSecondary}
      />
      <ThemedText type="smallBold" themeColor={filled ? 'text' : 'textSecondary'}>
        {loading ? 'SUBIENDO…' : filled ? 'CARGADO' : label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: Spacing.four, paddingTop: Spacing.five, paddingBottom: Spacing.six },
  row: { flexDirection: 'row', gap: Spacing.three },
  col: { flex: 1 },
  field: { gap: Spacing.two },
  label: { marginLeft: Spacing.one },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  dni: {
    flex: 1,
    height: 92,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    overflow: 'hidden',
  },
  dniImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.35 },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.four,
    minHeight: 52,
  },
  consent: {
    flexDirection: 'row',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.four,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { gap: Spacing.three, paddingBottom: Spacing.four },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '70%',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.five,
    gap: Spacing.three,
  },
  sheetTitle: { marginBottom: Spacing.two },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.four,
    borderBottomWidth: 1,
  },
});
