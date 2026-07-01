import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';

import { ApiError } from '@/api/client';
import { cambiarEmail, cambiarPassword } from '@/api/endpoints/usuarios';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon, IconName } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';
import { useTheme } from '@/hooks/use-theme';
import { getNotifPrefs, saveNotifPrefs, type NotifPrefs } from '@/utils/notifPrefs';

// ─── Textos legales ──────────────────────────────────────────────────────────

const TERMINOS_TEXT = `Última actualización: junio 2026

1. ACEPTACIÓN
Al registrarse en Bidify y participar en subastas, el usuario acepta estos Términos y Condiciones en su totalidad.

2. REGISTRO
El acceso a la plataforma requiere la verificación de identidad mediante documento oficial. Todo usuario es responsable de la veracidad de los datos proporcionados. La empresa se reserva el derecho de suspender cuentas que incumplan este requisito.

3. PARTICIPACIÓN EN SUBASTAS
Las pujas realizadas son ofertas vinculantes. El postor que resulte ganador de un lote está obligado a abonar el monto ofertado más la comisión del 10% dentro del plazo establecido. El incumplimiento genera una multa automática del 10% del valor del lote.

4. MULTAS E IMPAGO
Las multas deben abonarse dentro de las 72 horas de su emisión. Transcurrido ese plazo sin pago, el caso se deriva a instancias judiciales y la cuenta queda suspendida permanentemente.

5. BIENES EN CONSIGNACIÓN
Al solicitar la inclusión de un bien, el usuario declara ser su legítimo propietario y que el bien no registra impedimentos legales. La empresa realizará una inspección y formulará una propuesta de precio base y comisión que el usuario podrá aceptar o rechazar.

6. SEGUROS
Todo bien aceptado para subasta cuenta con cobertura de seguro durante el período de evaluación y hasta la entrega al comprador. La póliza corre por cuenta de la empresa.

7. CATEGORÍAS
Los usuarios son clasificados según su nivel de participación (Común, Especial, Plata, Oro, Platino). Ciertas subastas requieren una categoría mínima para pujar.

8. MODIFICACIONES
Bidify se reserva el derecho de modificar estos términos con notificación previa de 15 días hábiles.`;

const PRIVACIDAD_TEXT = `Última actualización: junio 2026

1. DATOS RECOPILADOS
Recopilamos: nombre completo, documento de identidad, domicilio, país de residencia, dirección de correo electrónico y datos de medios de pago declarados.

2. USO DE LOS DATOS
Los datos personales se utilizan exclusivamente para:
• Verificar la identidad del postor antes de su habilitación.
• Gestionar la participación en subastas y el cobro de comisiones.
• Enviar notificaciones relacionadas con la actividad del usuario.
• Cumplir con obligaciones legales y fiscales.

3. ALMACENAMIENTO Y SEGURIDAD
Los datos se almacenan en servidores con cifrado en reposo. Las contraseñas se guardan con hash bcrypt y nunca en texto plano. El acceso a los datos está restringido al personal autorizado de la empresa.

4. COMPARTICIÓN CON TERCEROS
No vendemos ni cedemos datos a terceros con fines comerciales. Podemos compartir información con autoridades competentes cuando así lo exija la ley o en casos de derivación judicial por impago.

5. RETENCIÓN
Los datos se conservan durante la vigencia de la cuenta y hasta 5 años después del cierre, en cumplimiento de normativas contables y fiscales.

6. DERECHOS DEL USUARIO
El usuario puede solicitar en cualquier momento el acceso, rectificación o eliminación de sus datos escribiendo a privacidad@bidify.local. La eliminación de la cuenta no procede si existen obligaciones pendientes (multas impagas, subastas activas).

7. COOKIES
La aplicación móvil no utiliza cookies. La versión web puede utilizar cookies de sesión estrictamente necesarias para el funcionamiento.

8. CONTACTO
Para consultas sobre privacidad: privacidad@bidify.local`;

// ─── Modal base ───────────────────────────────────────────────────────────────

function SettingsModal({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOuter}>
        <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kavWrapper}>
          <View style={[styles.sheet, { backgroundColor: theme.card }]}>
            <View style={styles.sheetHeader}>
              <ThemedText type="heading">{title}</ThemedText>
              <Pressable onPress={onClose} hitSlop={12}>
                <Icon name="close" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>
            {children}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Modal: cambiar contraseña ────────────────────────────────────────────────

function PasswordModal({
  visible,
  onClose,
  usuarioId,
}: {
  visible: boolean;
  onClose: () => void;
  usuarioId: number;
}) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setActual('');
      setNueva('');
      setConfirmar('');
      setError(null);
    }
  }, [visible]);

  async function handleSubmit() {
    if (!actual || !nueva || !confirmar) {
      setError('Completá todos los campos.');
      return;
    }
    if (nueva.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (nueva !== confirmar) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await cambiarPassword(usuarioId, { password_actual: actual, password_nueva: nueva });
      onClose();
      Alert.alert('Listo', 'Tu contraseña fue actualizada correctamente.');
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : 'No se pudo cambiar la contraseña.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SettingsModal visible={visible} onClose={onClose} title="Cambiar contraseña">
      <View style={styles.form}>
        <Input
          label="Contraseña actual"
          secureTextEntry
          autoCapitalize="none"
          value={actual}
          onChangeText={setActual}
        />
        <Input
          label="Nueva contraseña"
          secureTextEntry
          autoCapitalize="none"
          value={nueva}
          onChangeText={setNueva}
        />
        <Input
          label="Confirmar nueva contraseña"
          secureTextEntry
          autoCapitalize="none"
          value={confirmar}
          onChangeText={setConfirmar}
        />
        {error ? (
          <ThemedText type="caption" style={styles.errorText}>
            {error}
          </ThemedText>
        ) : null}
        <Button
          title={loading ? 'Guardando…' : 'Guardar contraseña'}
          fullWidth
          loading={loading}
          onPress={handleSubmit}
        />
      </View>
    </SettingsModal>
  );
}

// ─── Modal: cambiar email ─────────────────────────────────────────────────────

function EmailModal({
  visible,
  onClose,
  usuarioId,
  onSuccess,
}: {
  visible: boolean;
  onClose: () => void;
  usuarioId: number;
  onSuccess: () => void | Promise<void>;
}) {
  const [emailNuevo, setEmailNuevo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setEmailNuevo('');
      setError(null);
    }
  }, [visible]);

  async function handleSubmit() {
    if (!emailNuevo.trim()) {
      setError('Ingresá un email válido.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const updated = await cambiarEmail(usuarioId, { email_nuevo: emailNuevo.trim() });
      await onSuccess();
      onClose();
      Alert.alert('Listo', `Tu email fue actualizado a ${updated.email}.`);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : 'No se pudo cambiar el email.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SettingsModal visible={visible} onClose={onClose} title="Cambiar email">
      <View style={styles.form}>
        <Input
          label="Nuevo email"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={emailNuevo}
          onChangeText={setEmailNuevo}
          error={error ?? undefined}
        />
        <Button
          title={loading ? 'Guardando…' : 'Guardar email'}
          fullWidth
          loading={loading}
          onPress={handleSubmit}
        />
      </View>
    </SettingsModal>
  );
}

// ─── Modal: preferencias de notificaciones ────────────────────────────────────

const NOTIF_TIPOS: { key: keyof NotifPrefs; label: string; icon: IconName }[] = [
  { key: 'ventas', label: 'Subastas y ventas', icon: 'trophy-outline' },
  { key: 'multas', label: 'Multas e impagos', icon: 'warning-outline' },
  { key: 'solicitudes', label: 'Estado de mis bienes', icon: 'cube-outline' },
  { key: 'medios_pago', label: 'Medios de pago', icon: 'card-outline' },
];

function NotifPrefsModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [prefs, setPrefs] = useState<NotifPrefs>({
    ventas: true,
    multas: true,
    solicitudes: true,
    medios_pago: true,
  });

  useEffect(() => {
    if (visible) {
      getNotifPrefs().then(setPrefs);
    }
  }, [visible]);

  async function toggle(key: keyof NotifPrefs) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    await saveNotifPrefs(next);
  }

  return (
    <SettingsModal visible={visible} onClose={onClose} title="Notificaciones">
      <View style={styles.form}>
        {NOTIF_TIPOS.map((t) => (
          <View key={t.key} style={styles.switchRow}>
            <Icon name={t.icon} size={18} color={theme.textSecondary} />
            <ThemedText type="default" style={styles.flex}>
              {t.label}
            </ThemedText>
            <Switch
              value={prefs[t.key]}
              onValueChange={() => toggle(t.key)}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor="#fff"
            />
          </View>
        ))}
        <ThemedText type="caption" themeColor="textMuted" style={styles.notifHint}>
          Los cambios se aplican a las notificaciones en la app.
        </ThemedText>
      </View>
    </SettingsModal>
  );
}

// ─── Modal: legal (términos / privacidad) ─────────────────────────────────────

function LegalModal({
  visible,
  onClose,
  title,
  text,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  text: string;
}) {
  return (
    <SettingsModal visible={visible} onClose={onClose} title={title}>
      <ScrollView style={styles.legalScroll} showsVerticalScrollIndicator={false}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.legalText}>
          {text}
        </ThemedText>
      </ScrollView>
    </SettingsModal>
  );
}

// ─── Componentes de fila ──────────────────────────────────────────────────────

type RowDef = { icon: IconName; label: string; onPress: () => void };

function SectionTitle({ label }: { label: string }) {
  return (
    <ThemedText type="caption" themeColor="textSecondary" style={styles.sectionTitle}>
      {label.toUpperCase()}
    </ThemedText>
  );
}

function RowItem({ row }: { row: RowDef }) {
  const theme = useTheme();
  return (
    <Card padded={false} onPress={row.onPress} style={styles.row}>
      <View style={styles.rowLeft}>
        <Icon name={row.icon} size={20} color={theme.primary} />
        <ThemedText type="default">{row.label}</ThemedText>
      </View>
      <Icon name="chevron-forward" size={18} color={theme.textSecondary} />
    </Card>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

type ActiveModal = 'password' | 'email' | 'notif' | 'terminos' | 'privacidad' | null;

export default function SettingsScreen() {
  const { usuarioId, refreshUser } = useSession();
  const [active, setActive] = useState<ActiveModal>(null);

  const open = (m: ActiveModal) => setActive(m);
  const close = () => setActive(null);

  const cuentaRows: RowDef[] = [
    { icon: 'lock-closed-outline', label: 'Cambiar contraseña', onPress: () => open('password') },
    { icon: 'mail-outline', label: 'Cambiar email', onPress: () => open('email') },
  ];

  const notifRows: RowDef[] = [
    {
      icon: 'notifications-outline',
      label: 'Preferencias de notificaciones',
      onPress: () => open('notif'),
    },
  ];

  const legalRows: RowDef[] = [
    {
      icon: 'document-text-outline',
      label: 'Términos y condiciones',
      onPress: () => open('terminos'),
    },
    {
      icon: 'shield-outline',
      label: 'Política de privacidad',
      onPress: () => open('privacidad'),
    },
  ];

  return (
    <Screen padded>
      <ScreenHeader title="Ajustes" fallbackRoute="/(tabs)/profile" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <SectionTitle label="Cuenta" />
        {cuentaRows.map((r) => (
          <RowItem key={r.label} row={r} />
        ))}

        <SectionTitle label="Notificaciones" />
        {notifRows.map((r) => (
          <RowItem key={r.label} row={r} />
        ))}

        <SectionTitle label="Legal" />
        {legalRows.map((r) => (
          <RowItem key={r.label} row={r} />
        ))}

        <View style={styles.version}>
          <ThemedText type="caption" themeColor="textMuted">
            Bidify v1.0.0
          </ThemedText>
        </View>
      </ScrollView>

      {usuarioId != null && (
        <>
          <PasswordModal
            visible={active === 'password'}
            onClose={close}
            usuarioId={usuarioId}
          />
          <EmailModal
            visible={active === 'email'}
            onClose={close}
            usuarioId={usuarioId}
            onSuccess={refreshUser}
          />
        </>
      )}

      <NotifPrefsModal visible={active === 'notif'} onClose={close} />

      <LegalModal
        visible={active === 'terminos'}
        onClose={close}
        title="Términos y condiciones"
        text={TERMINOS_TEXT}
      />
      <LegalModal
        visible={active === 'privacidad'}
        onClose={close}
        title="Política de privacidad"
        text={PRIVACIDAD_TEXT}
      />
    </Screen>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: { gap: Spacing.two, paddingVertical: Spacing.four, paddingBottom: Spacing.seven },
  sectionTitle: { marginTop: Spacing.three, marginLeft: Spacing.one },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.four,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  version: { alignItems: 'center', marginTop: Spacing.five },

  // Modal
  modalOuter: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.55)' },
  kavWrapper: { width: '100%' },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: Spacing.five,
    paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.six,
    maxHeight: '90%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.five,
  },

  // Forms
  form: { gap: Spacing.four },
  errorText: { color: 'red', textAlign: 'center' },

  // Notif toggles
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  flex: { flex: 1 },
  notifHint: { marginTop: Spacing.one },

  // Legal
  legalScroll: { maxHeight: 380 },
  legalText: { lineHeight: 22 },
});
