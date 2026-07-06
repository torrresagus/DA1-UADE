import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import type { CuentaCobroCreate, CuentaCobroOut, MedioPagoCreate, MedioPagoOut, MedioPagoUpdate, Moneda, TipoMedioPago } from '@/api/types';
import {
  useCreateCuentaCobro,
  useCreateMedioPago,
  useCuentasCobro,
  useDeleteMedioPago,
  useMediosPago,
  useUpdateMedioPago,
} from '@/api/hooks/useMediosPago';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Icon, IconName } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Radius, Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';
import { useTheme } from '@/hooks/use-theme';

// ─── Constantes ───────────────────────────────────────────────────────────────

const TIPO_OPTIONS: { value: TipoMedioPago; label: string; icon: IconName }[] = [
  { value: 'tarjeta_credito', label: 'Tarjeta', icon: 'card' },
  { value: 'cuenta_bancaria', label: 'Cuenta bancaria', icon: 'business' },
  { value: 'cheque_certificado', label: 'Cheque', icon: 'document-text' },
];

const CARD_BRANDS = ['VISA', 'Mastercard', 'Amex', 'Otra'];
const TIPO_CUENTA_OPTIONS = [
  { value: 'caja_ahorro', label: 'Caja de ahorro' },
  { value: 'cuenta_corriente', label: 'Cuenta corriente' },
];
const DOC_TIPO_OPTIONS = [
  { value: 'dni', label: 'DNI' },
  { value: 'cuil', label: 'CUIL' },
  { value: 'cuit', label: 'CUIT' },
];
const CHEQUE_ESTADO_OPTIONS = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'depositado', label: 'Depositado' },
  { value: 'rechazado', label: 'Rechazado' },
  { value: 'cobrado', label: 'Cobrado' },
];
const MONEDA_OPTIONS: { value: Moneda; label: string }[] = [
  { value: 'ARS', label: 'ARS (Pesos)' },
  { value: 'USD', label: 'USD (Dólares)' },
];

// ─── Formatters ───────────────────────────────────────────────────────────────

/** "1234567890123456" → "1234 5678 9012 3456" */
function fmtCard(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 16);
  return d.replace(/(.{4})(?=.)/g, '$1 ');
}

/** "1226" → "12/26", backspace-safe */
function fmtExpiry(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

/** "43174354" → "43.174.354", groups-of-3 from right */
function fmtDNI(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 3) return d;
  const rev = d.split('').reverse().join('');
  const groups = rev.match(/.{1,3}/g) ?? [];
  return groups
    .map((g) => g.split('').reverse().join(''))
    .reverse()
    .join('.');
}

/** "20123456789" → "20-12345678-9" */
function fmtCuilCuit(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 10) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

/** "01012024" → "01/01/2024" */
function fmtDate(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** Allow only letters, accents and spaces */
function fmtLetters(raw: string): string {
  return raw.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g, '');
}

/** Allow only digits, optionally capped */
function fmtDigits(raw: string, max?: number): string {
  const d = raw.replace(/\D/g, '');
  return max !== undefined ? d.slice(0, max) : d;
}

/** "10000" → "10.000" — dot thousand separator for money inputs */
function fmtMoney(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (!d) return '';
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// ─── Validaciones inline ──────────────────────────────────────────────────────

/** Returns error string or undefined. Only reports errors on "complete" inputs. */
function validateExpiry(val: string): string | undefined {
  if (val.length < 5) return undefined; // still typing
  const [mm, yy] = val.split('/');
  const month = Number(mm);
  const year = Number(yy);
  if (isNaN(month) || month < 1 || month > 12) return 'Mes inválido (01–12)';
  if (isNaN(year) || year < 26) return 'Año inválido (mínimo 26)';
  return undefined;
}

function validateDNI(val: string): string | undefined {
  if (!val) return undefined;
  const digits = val.replace(/\D/g, '');
  if (digits.length > 0 && (digits.length < 7 || digits.length > 8)) return 'DNI debe tener 7 u 8 dígitos';
  return undefined;
}

function validateCBU(val: string): string | undefined {
  if (!val) return undefined;
  if (val.length !== 22) return 'CBU debe tener exactamente 22 dígitos';
  return undefined;
}

function validateCuilCuit(val: string): string | undefined {
  if (!val) return undefined;
  const digits = val.replace(/\D/g, '');
  if (digits.length > 0 && digits.length !== 11) return 'Debe tener 11 dígitos';
  return undefined;
}

function validateDate(val: string): string | undefined {
  if (!val || val.length < 10) return undefined;
  const [dd, mm, yyyy] = val.split('/');
  const day = Number(dd), month = Number(mm), year = Number(yyyy);
  if (isNaN(day) || day < 1 || day > 31) return 'Día inválido';
  if (isNaN(month) || month < 1 || month > 12) return 'Mes inválido';
  if (isNaN(year) || year < 1900) return 'Año inválido';
  return undefined;
}

function parseDateES(val: string): Date | null {
  if (val.length < 10) return null;
  const [dd, mm, yyyy] = val.split('/');
  const day = Number(dd), month = Number(mm), year = Number(yyyy);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  return new Date(year, month - 1, day);
}

function crossDateError(emision: string, vto: string): string | undefined {
  const e = parseDateES(emision);
  const v = parseDateES(vto);
  if (e && v && v < e) return 'No puede ser anterior a la fecha de emisión';
  return undefined;
}

// ─── Estado del formulario ────────────────────────────────────────────────────

const EMPTY_FORM = {
  titular: '',
  pais: 'Argentina',
  // Tarjeta
  cardNumber: '',
  cardExpiry: '',
  cardCvv: '',
  cardBrand: '',
  cardDoc: '',
  cardAlias: '',
  // Cuenta bancaria
  banco: '',
  tipoCuenta: 'caja_ahorro' as 'caja_ahorro' | 'cuenta_corriente',
  numeroCuenta: '',
  cbu: '',
  cuentaAlias: '',
  docTitularTipo: 'cuil' as 'dni' | 'cuil' | 'cuit',
  cuilCuit: '',
  moneda: 'ARS' as Moneda,
  // Cheque
  chequeNumero: '',
  chequeBanco: '',
  chequeCuenta: '',
  chequeFechaEmision: '',
  chequeFechaVto: '',
  chequeImporte: '',
  chequeEstado: 'pendiente',
  chequeMoneda: 'ARS' as Moneda,
};

// ─── Payload y validación ─────────────────────────────────────────────────────

function buildPayload(tipo: TipoMedioPago, f: typeof EMPTY_FORM): MedioPagoCreate {
  if (tipo === 'tarjeta_credito') {
    const digits = f.cardNumber.replace(/\D/g, '');
    const last4 = digits.slice(-4) || f.cardNumber.trim().slice(-4);
    const detalle = f.cardAlias.trim() || `${f.cardBrand} **** ${last4}`;
    return { tipo, titular: f.titular.trim(), detalle, pais: f.pais.trim() };
  }
  if (tipo === 'cuenta_bancaria') {
    const detalle = f.cuentaAlias.trim() || f.cbu || f.numeroCuenta;
    return { tipo, titular: f.titular.trim(), detalle, pais: f.pais.trim(), moneda: f.moneda };
  }
  const detalle = `Cheque #${f.chequeNumero} – ${f.chequeBanco.trim()}`;
  return {
    tipo,
    titular: f.titular.trim(),
    detalle,
    pais: f.pais.trim(),
    moneda: f.chequeMoneda,
    monto_garantia: f.chequeImporte.replace(/\./g, ''),
  };
}

function isFormValid(tipo: TipoMedioPago, f: typeof EMPTY_FORM): boolean {
  if (!f.titular.trim()) return false;
  if (tipo === 'tarjeta_credito') {
    const digits = f.cardNumber.replace(/\D/g, '');
    return (
      digits.length === 16 &&
      f.cardBrand.length > 0 &&
      f.cardExpiry.length === 5 &&
      !validateExpiry(f.cardExpiry)
    );
  }
  if (tipo === 'cuenta_bancaria') {
    return f.banco.trim().length > 0 && (f.cbu.length === 22 || f.numeroCuenta.length > 0);
  }
  return (
    f.chequeNumero.length > 0 &&
    f.chequeBanco.trim().length > 0 &&
    f.chequeImporte.length > 0
  );
}

// ─── Helpers de lista ─────────────────────────────────────────────────────────

function tipoMeta(tipo: TipoMedioPago): { label: string; icon: IconName } {
  return TIPO_OPTIONS.find((o) => o.value === tipo) ?? { label: tipo, icon: 'card' };
}

function statusBadge(m: MedioPagoOut): { label: string; tone: BadgeTone } {
  if (m.verificado) return { label: 'Verificado', tone: 'success' };
  if (m.estado === 'rechazado') return { label: 'Rechazado', tone: 'danger' };
  return { label: 'Pendiente', tone: 'gold' };
}

// ─── Componente auxiliar ──────────────────────────────────────────────────────

function FieldLabel({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <ThemedText type="caption" style={{ color: theme.textSecondary }}>
      {label}
    </ThemedText>
  );
}

// ─── Pantalla ─────────────────────────────────────────────────────────────────

export default function PaymentsScreen() {
  const theme = useTheme();
  const { usuarioId } = useSession();

  const methods = useMediosPago(usuarioId);
  const createM = useCreateMedioPago(usuarioId ?? 0);
  const delM = useDeleteMedioPago(usuarioId ?? 0);
  const updateM = useUpdateMedioPago(usuarioId ?? 0);
  const cuentas = useCuentasCobro(usuarioId);
  const createCuenta = useCreateCuentaCobro(usuarioId ?? 0);

  const [editing, setEditing] = useState<MedioPagoOut | null>(null);
  const [editForm, setEditForm] = useState({ titular: '', detalle: '', pais: '', monto_garantia: '', moneda: 'ARS' as Moneda });
  const [editError, setEditError] = useState<string | null>(null);
  const setEdit = (k: keyof typeof editForm) => (v: string) => setEditForm((f) => ({ ...f, [k]: v }));

  const [formOpen, setFormOpen] = useState(false);
  const [tipo, setTipo] = useState<TipoMedioPago>('tarjeta_credito');
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const [cuentaFormOpen, setCuentaFormOpen] = useState(false);
  const [cuentaForm, setCuentaForm] = useState({ banco: '', pais: 'Argentina', numero_cuenta: '', titular: '', declarada_antes_subasta: false });
  const [cuentaError, setCuentaError] = useState<string | null>(null);
  const setCuenta = (k: keyof typeof cuentaForm) => (v: string) => setCuentaForm((f) => ({ ...f, [k]: v }));
  const canSubmitCuenta = cuentaForm.banco.trim().length > 0 && cuentaForm.numero_cuenta.trim().length > 0 && cuentaForm.titular.trim().length > 0 && !createCuenta.isPending;

  const set = (k: keyof typeof EMPTY_FORM) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  if (usuarioId == null) {
    return (
      <Screen padded>
        <ScreenHeader title="Cartera & Pagos" />
        <EmptyState icon="person-circle-outline" message="Iniciá sesión para gestionar tus métodos de pago" />
      </Screen>
    );
  }

  const closeForm = () => {
    setFormOpen(false);
    setForm(EMPTY_FORM);
    setTipo('tarjeta_credito');
    setFormError(null);
  };

  const onSubmit = async () => {
    setFormError(null);
    try {
      await createM.mutateAsync(buildPayload(tipo, form));
      closeForm();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.detail : 'Ocurrió un error');
    }
  };

  const onDelete = (id: number) => {
    setRowError(null);
    delM.mutate(id, {
      onError: (err) => setRowError(err instanceof ApiError ? err.detail : 'Ocurrió un error'),
    });
  };

  const openEdit = (m: MedioPagoOut) => {
    setEditing(m);
    setEditForm({
      titular: m.titular,
      detalle: m.detalle,
      pais: m.pais,
      monto_garantia: m.monto_garantia != null ? String(m.monto_garantia) : '',
      moneda: (m.moneda ?? 'ARS') as Moneda,
    });
    setEditError(null);
  };

  const onSaveEdit = async () => {
    if (!editing) return;
    setEditError(null);
    try {
      const body: MedioPagoUpdate = {
        titular: editForm.titular.trim(),
        detalle: editForm.detalle.trim(),
        pais: editForm.pais.trim(),
      };
      if (editing.tipo !== 'tarjeta_credito') body.moneda = editForm.moneda;
      if (editing.tipo === 'cheque_certificado') {
        body.monto_garantia = editForm.monto_garantia.replace(/\./g, '') || null;
      }
      await updateM.mutateAsync({ mpId: editing.id, body });
      setEditing(null);
    } catch (err) {
      setEditError(err instanceof ApiError ? err.detail : 'Ocurrió un error');
    }
  };

  const canSubmit = isFormValid(tipo, form) && !createM.isPending;

  // Errores inline calculados reactivamente
  const expiryError = validateExpiry(form.cardExpiry);
  const dniError = validateDNI(form.cardDoc);
  const cbuError = validateCBU(form.cbu);
  const cuilError = validateCuilCuit(form.cuilCuit);
  const fechaEmisionError = validateDate(form.chequeFechaEmision);
  const fechaVtoError = validateDate(form.chequeFechaVto) ?? crossDateError(form.chequeFechaEmision, form.chequeFechaVto);

  return (
    <Screen padded>
      <ScreenHeader title="Cartera & Pagos" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ThemedText type="small" themeColor="textSecondary">
          Gestioná tus tarjetas y cuentas para participar y cobrar tus ventas.
        </ThemedText>

        <View style={styles.section}>
          <ThemedText type="heading">Tarjetas y métodos</ThemedText>
          {methods.isLoading ? (
            <LoadingState />
          ) : methods.isError ? (
            <ErrorState
              message={methods.error instanceof ApiError ? methods.error.detail : 'No se pudieron cargar'}
              onRetry={methods.refetch}
            />
          ) : (methods.data?.length ?? 0) === 0 ? (
            <EmptyState icon="card-outline" message="No tenés métodos de pago" />
          ) : (
            methods.data!.map((m) => {
              const meta = tipoMeta(m.tipo);
              const badge = statusBadge(m);
              return (
                <Card key={m.id} style={styles.method}>
                  <View style={[styles.methodIcon, { backgroundColor: theme.cardElevated }]}>
                    <Icon name={meta.icon} size={20} color={theme.primary} />
                  </View>
                  <View style={styles.flex}>
                    <View style={styles.methodTop}>
                      <ThemedText type="smallBold">{meta.label}</ThemedText>
                      <Badge label={badge.label} tone={badge.tone} />
                    </View>
                    <ThemedText type="caption" themeColor="textSecondary">
                      {m.detalle} · {m.pais}
                    </ThemedText>
                  </View>
                  <Button
                    title=""
                    variant="ghost"
                    size="sm"
                    onPress={() => openEdit(m)}
                    disabled={updateM.isPending}
                    icon={<Icon name="create-outline" size={18} color={theme.primary} />}
                    style={styles.iconBtn}
                  />
                  <Button
                    title=""
                    variant="ghost"
                    size="sm"
                    onPress={() => onDelete(m.id)}
                    disabled={delM.isPending}
                    icon={<Icon name="trash-outline" size={18} color={theme.danger} />}
                    style={styles.iconBtn}
                  />
                </Card>
              );
            })
          )}
          {rowError ? <ThemedText type="caption" style={{ color: theme.danger }}>{rowError}</ThemedText> : null}
          <Card onPress={() => setFormOpen(true)} style={styles.addCard}>
            <Icon name="add-circle-outline" size={20} color={theme.primary} />
            <ThemedText type="smallBold" style={{ color: theme.primary }}>
              Agregar método de pago
            </ThemedText>
          </Card>
        </View>

        <View style={styles.section}>
          <ThemedText type="heading">Cuentas de cobro</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            Donde acreditamos el cobro de tus ventas. Deben declararse antes del inicio de la subasta.
          </ThemedText>
          {cuentas.isLoading ? (
            <LoadingState inline />
          ) : cuentas.isError ? (
            <ErrorState message="No se pudieron cargar tus cuentas." onRetry={cuentas.refetch} />
          ) : (cuentas.data?.length ?? 0) === 0 ? (
            <EmptyState icon="business-outline" message="No tenés cuentas de cobro declaradas" />
          ) : (
            cuentas.data!.map((c: CuentaCobroOut) => (
              <Card key={c.id} style={styles.method}>
                <View style={[styles.methodIcon, { backgroundColor: theme.cardElevated }]}>
                  <Icon name="business" size={20} color={theme.primary} />
                </View>
                <View style={styles.flex}>
                  <View style={styles.methodTop}>
                    <ThemedText type="smallBold">{c.banco}</ThemedText>
                    {c.declarada_antes_subasta ? (
                      <Badge label="Declarada" tone="success" />
                    ) : (
                      <Badge label="Sin declarar" tone="neutral" />
                    )}
                  </View>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {c.numero_cuenta} · {c.titular} · {c.pais}
                  </ThemedText>
                </View>
              </Card>
            ))
          )}
          <Card onPress={() => setCuentaFormOpen(true)} style={styles.addCard}>
            <Icon name="add-circle-outline" size={20} color={theme.primary} />
            <ThemedText type="smallBold" style={{ color: theme.primary }}>
              Agregar cuenta de cobro
            </ThemedText>
          </Card>
        </View>
      </ScrollView>

      {/* ── Modal cuenta de cobro ── */}
      <Modal visible={cuentaFormOpen} transparent animationType="slide" onRequestClose={() => setCuentaFormOpen(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.sheetHeader}>
              <ThemedText type="heading">Agregar cuenta de cobro</ThemedText>
              <Button
                title=""
                variant="ghost"
                size="sm"
                onPress={() => { setCuentaFormOpen(false); setCuentaError(null); }}
                icon={<Icon name="close" size={20} color={theme.textSecondary} />}
                style={styles.iconBtn}
              />
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.form}>
              <Input
                label="Banco *"
                placeholder="Ej: Banco Galicia"
                value={cuentaForm.banco}
                onChangeText={setCuenta('banco')}
              />
              <Input
                label="Número de cuenta *"
                placeholder="CBU, IBAN o número local"
                value={cuentaForm.numero_cuenta}
                onChangeText={setCuenta('numero_cuenta')}
                keyboardType="numeric"
              />
              <Input
                label="Titular *"
                placeholder="Nombre completo del titular"
                value={cuentaForm.titular}
                onChangeText={setCuenta('titular')}
              />
              <Input
                label="País"
                placeholder="Argentina"
                value={cuentaForm.pais}
                onChangeText={setCuenta('pais')}
              />
              <Pressable
                onPress={() => setCuentaForm((f) => ({ ...f, declarada_antes_subasta: !f.declarada_antes_subasta }))}
                style={[styles.checkRow, { borderColor: theme.border, backgroundColor: theme.cardElevated, borderRadius: 8, padding: 12 }]}>
                <View style={[styles.checkbox, {
                  backgroundColor: cuentaForm.declarada_antes_subasta ? theme.primary : 'transparent',
                  borderColor: cuentaForm.declarada_antes_subasta ? theme.primary : theme.borderStrong,
                }]}>
                  {cuentaForm.declarada_antes_subasta ? <Icon name="checkmark" size={14} color={theme.onPrimary} /> : null}
                </View>
                <View style={styles.flex}>
                  <ThemedText type="smallBold">Declarada antes de la subasta</ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    Requerido para recibir el cobro de tus ventas
                  </ThemedText>
                </View>
              </Pressable>
              {cuentaError ? (
                <ThemedText type="caption" style={{ color: theme.danger }}>{cuentaError}</ThemedText>
              ) : null}
              <Button
                title={createCuenta.isPending ? 'Guardando…' : 'Guardar cuenta'}
                onPress={async () => {
                  setCuentaError(null);
                  try {
                    const body: CuentaCobroCreate = {
                      banco: cuentaForm.banco.trim(),
                      pais: cuentaForm.pais.trim(),
                      numero_cuenta: cuentaForm.numero_cuenta.trim(),
                      titular: cuentaForm.titular.trim(),
                      declarada_antes_subasta: cuentaForm.declarada_antes_subasta,
                    };
                    await createCuenta.mutateAsync(body);
                    setCuentaFormOpen(false);
                    setCuentaForm({ banco: '', pais: 'Argentina', numero_cuenta: '', titular: '', declarada_antes_subasta: false });
                  } catch (err) {
                    setCuentaError(err instanceof ApiError ? err.detail : 'Ocurrió un error');
                  }
                }}
                loading={createCuenta.isPending}
                disabled={!canSubmitCuenta}
                fullWidth
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal de edición de método ── */}
      <Modal visible={editing != null} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.sheetHeader}>
              <ThemedText type="heading">Editar método de pago</ThemedText>
              <Button
                title=""
                variant="ghost"
                size="sm"
                onPress={() => setEditing(null)}
                icon={<Icon name="close" size={20} color={theme.textSecondary} />}
                style={styles.iconBtn}
              />
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.form}>
              <Input label="Titular" value={editForm.titular} onChangeText={setEdit('titular')} />
              <Input label="Descripción / alias" value={editForm.detalle} onChangeText={setEdit('detalle')} />
              <Input label="País" value={editForm.pais} onChangeText={setEdit('pais')} />
              {editing?.tipo === 'cheque_certificado' ? (
                <Input
                  label="Monto garantizado"
                  keyboardType="numeric"
                  value={editForm.monto_garantia}
                  onChangeText={(t) => setEdit('monto_garantia')(fmtMoney(t))}
                />
              ) : null}
              {editing?.tipo !== 'tarjeta_credito' ? (
                <View style={styles.field}>
                  <FieldLabel label="Moneda" />
                  <View style={styles.chipRow}>
                    {MONEDA_OPTIONS.map((o) => (
                      <Chip
                        key={o.value}
                        label={o.label}
                        active={editForm.moneda === o.value}
                        onPress={() => setEditForm((f) => ({ ...f, moneda: o.value }))}
                      />
                    ))}
                  </View>
                </View>
              ) : null}
              <ThemedText type="caption" themeColor="textSecondary">
                Al editar, el método vuelve a quedar pendiente de verificación.
              </ThemedText>
              {editError ? (
                <ThemedText type="caption" style={{ color: theme.danger }}>{editError}</ThemedText>
              ) : null}
              <Button
                title="Guardar cambios"
                onPress={onSaveEdit}
                loading={updateM.isPending}
                disabled={updateM.isPending || editForm.titular.trim().length === 0}
                fullWidth
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Modal del formulario ── */}
      <Modal visible={formOpen} transparent animationType="slide" onRequestClose={closeForm}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.sheetHeader}>
              <ThemedText type="heading">Agregar método de pago</ThemedText>
              <Button
                title=""
                variant="ghost"
                size="sm"
                onPress={closeForm}
                icon={<Icon name="close" size={20} color={theme.textSecondary} />}
                style={styles.iconBtn}
              />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.form}>
              {/* Selector de tipo */}
              <View style={styles.field}>
                <FieldLabel label="Tipo" />
                <View style={styles.chipRow}>
                  {TIPO_OPTIONS.map((o) => (
                    <Chip
                      key={o.value}
                      label={o.label}
                      active={tipo === o.value}
                      onPress={() => { setTipo(o.value); setForm(EMPTY_FORM); setFormError(null); }}
                    />
                  ))}
                </View>
              </View>

              {/* ══ TARJETA ══ */}
              {tipo === 'tarjeta_credito' && (
                <>
                  <Input
                    label="Número de tarjeta *"
                    placeholder="1234 5678 9012 3456"
                    keyboardType="numeric"
                    maxLength={19}
                    value={form.cardNumber}
                    onChangeText={(t) => set('cardNumber')(fmtCard(t))}
                  />
                  <Input
                    label="Nombre del titular *"
                    placeholder="Como figura en la tarjeta"
                    autoCapitalize="words"
                    value={form.titular}
                    onChangeText={(t) => set('titular')(fmtLetters(t))}
                  />
                  <View style={styles.row}>
                    <View style={styles.col}>
                      <Input
                        label="Vencimiento *"
                        placeholder="MM/AA"
                        keyboardType="numeric"
                        maxLength={5}
                        value={form.cardExpiry}
                        onChangeText={(t) => set('cardExpiry')(fmtExpiry(t))}
                        error={expiryError}
                      />
                    </View>
                    <View style={styles.col}>
                      <Input
                        label="CVV / CVC"
                        placeholder="123"
                        keyboardType="numeric"
                        maxLength={3}
                        secureTextEntry
                        value={form.cardCvv}
                        onChangeText={(t) => set('cardCvv')(fmtDigits(t, 3))}
                      />
                    </View>
                  </View>
                  <View style={styles.field}>
                    <FieldLabel label="Tipo de tarjeta *" />
                    <View style={styles.chipRow}>
                      {CARD_BRANDS.map((b) => (
                        <Chip
                          key={b}
                          label={b}
                          active={form.cardBrand === b}
                          onPress={() => setForm((f) => ({ ...f, cardBrand: b }))}
                        />
                      ))}
                    </View>
                  </View>
                  <Input
                    label="DNI del titular (opcional)"
                    placeholder="43.174.354"
                    keyboardType="numeric"
                    maxLength={10}
                    value={form.cardDoc}
                    onChangeText={(t) => set('cardDoc')(fmtDNI(t))}
                    error={dniError}
                  />
                  <Input
                    label="Alias descriptivo (opcional)"
                    placeholder='Ej: "Visa Personal"'
                    value={form.cardAlias}
                    onChangeText={set('cardAlias')}
                  />
                  <Input
                    label="País emisor"
                    placeholder="Argentina"
                    value={form.pais}
                    onChangeText={(t) => set('pais')(fmtLetters(t))}
                  />
                </>
              )}

              {/* ══ CUENTA BANCARIA ══ */}
              {tipo === 'cuenta_bancaria' && (
                <>
                  <Input
                    label="Banco *"
                    placeholder="Ej: Banco Galicia"
                    value={form.banco}
                    onChangeText={(t) => set('banco')(fmtLetters(t))}
                  />
                  <View style={styles.field}>
                    <FieldLabel label="Tipo de cuenta" />
                    <View style={styles.chipRow}>
                      {TIPO_CUENTA_OPTIONS.map((o) => (
                        <Chip
                          key={o.value}
                          label={o.label}
                          active={form.tipoCuenta === o.value}
                          onPress={() => setForm((f) => ({ ...f, tipoCuenta: o.value as typeof f.tipoCuenta }))}
                        />
                      ))}
                    </View>
                  </View>
                  <Input
                    label="Número de cuenta"
                    placeholder="Ej: 0001234/56"
                    keyboardType="numeric"
                    maxLength={13}
                    value={form.numeroCuenta}
                    onChangeText={(t) => set('numeroCuenta')(fmtDigits(t, 13))}
                  />
                  <Input
                    label="CBU *"
                    placeholder="22 dígitos"
                    keyboardType="numeric"
                    maxLength={22}
                    value={form.cbu}
                    onChangeText={(t) => set('cbu')(fmtDigits(t, 22))}
                    error={cbuError}
                  />
                  <Input
                    label="Alias (opcional)"
                    placeholder="Ej: mi.cuenta.galicia"
                    autoCapitalize="none"
                    value={form.cuentaAlias}
                    onChangeText={set('cuentaAlias')}
                  />
                  <Input
                    label="Titular de la cuenta *"
                    placeholder="Nombre completo"
                    autoCapitalize="words"
                    value={form.titular}
                    onChangeText={(t) => set('titular')(fmtLetters(t))}
                  />
                  {/* Selector DNI / CUIL / CUIT */}
                  <View style={styles.field}>
                    <FieldLabel label="Tipo de documento del titular" />
                    <View style={styles.chipRow}>
                      {DOC_TIPO_OPTIONS.map((o) => (
                        <Chip
                          key={o.value}
                          label={o.label}
                          active={form.docTitularTipo === o.value}
                          onPress={() => setForm((f) => ({ ...f, docTitularTipo: o.value as typeof f.docTitularTipo, cuilCuit: '' }))}
                        />
                      ))}
                    </View>
                  </View>
                  {form.docTitularTipo === 'dni' ? (
                    <Input
                      label="DNI"
                      placeholder="43.174.354"
                      keyboardType="numeric"
                      maxLength={10}
                      value={form.cuilCuit}
                      onChangeText={(t) => set('cuilCuit')(fmtDNI(t))}
                      error={validateDNI(form.cuilCuit)}
                    />
                  ) : (
                    <Input
                      label={form.docTitularTipo === 'cuil' ? 'CUIL' : 'CUIT'}
                      placeholder="20-12345678-9"
                      keyboardType="numeric"
                      maxLength={14}
                      value={form.cuilCuit}
                      onChangeText={(t) => set('cuilCuit')(fmtCuilCuit(t))}
                      error={cuilError}
                    />
                  )}
                  <View style={styles.field}>
                    <FieldLabel label="Moneda" />
                    <View style={styles.chipRow}>
                      {MONEDA_OPTIONS.map((o) => (
                        <Chip
                          key={o.value}
                          label={o.label}
                          active={form.moneda === o.value}
                          onPress={() => setForm((f) => ({ ...f, moneda: o.value }))}
                        />
                      ))}
                    </View>
                  </View>
                  <Input
                    label="País"
                    placeholder="Argentina"
                    value={form.pais}
                    onChangeText={(t) => set('pais')(fmtLetters(t))}
                  />
                </>
              )}

              {/* ══ CHEQUE CERTIFICADO ══ */}
              {tipo === 'cheque_certificado' && (
                <>
                  <Input
                    label="Número de cheque *"
                    placeholder="00012345"
                    keyboardType="numeric"
                    maxLength={8}
                    value={form.chequeNumero}
                    onChangeText={(t) => set('chequeNumero')(fmtDigits(t, 8))}
                  />
                  <Input
                    label="Banco emisor *"
                    placeholder="Ej: Banco Nación"
                    value={form.chequeBanco}
                    onChangeText={(t) => set('chequeBanco')(fmtLetters(t))}
                  />
                  <Input
                    label="Número de cuenta asociada"
                    placeholder="Cuenta del librador"
                    keyboardType="numeric"
                    maxLength={13}
                    value={form.chequeCuenta}
                    onChangeText={(t) => set('chequeCuenta')(fmtDigits(t, 13))}
                  />
                  <Input
                    label="Titular del cheque *"
                    placeholder="Nombre del librador"
                    autoCapitalize="words"
                    value={form.titular}
                    onChangeText={(t) => set('titular')(fmtLetters(t))}
                  />
                  <View style={styles.row}>
                    <View style={styles.col}>
                      <Input
                        label="Fecha de emisión"
                        placeholder="DD/MM/AAAA"
                        keyboardType="numeric"
                        maxLength={10}
                        value={form.chequeFechaEmision}
                        onChangeText={(t) => set('chequeFechaEmision')(fmtDate(t))}
                        error={fechaEmisionError}
                      />
                    </View>
                    <View style={styles.col}>
                      <Input
                        label="Vencimiento"
                        placeholder="DD/MM/AAAA"
                        keyboardType="numeric"
                        maxLength={10}
                        value={form.chequeFechaVto}
                        onChangeText={(t) => set('chequeFechaVto')(fmtDate(t))}
                        error={fechaVtoError}
                      />
                    </View>
                  </View>
                  <Input
                    label="Importe *"
                    placeholder="Monto garantizado"
                    keyboardType="numeric"
                    value={form.chequeImporte}
                    onChangeText={(t) => set('chequeImporte')(fmtMoney(t))}
                  />
                  <View style={styles.field}>
                    <FieldLabel label="Estado" />
                    <View style={styles.chipRow}>
                      {CHEQUE_ESTADO_OPTIONS.map((o) => (
                        <Chip
                          key={o.value}
                          label={o.label}
                          active={form.chequeEstado === o.value}
                          onPress={() => setForm((f) => ({ ...f, chequeEstado: o.value }))}
                        />
                      ))}
                    </View>
                  </View>
                  <View style={styles.field}>
                    <FieldLabel label="Moneda" />
                    <View style={styles.chipRow}>
                      {MONEDA_OPTIONS.map((o) => (
                        <Chip
                          key={o.value}
                          label={o.label}
                          active={form.chequeMoneda === o.value}
                          onPress={() => setForm((f) => ({ ...f, chequeMoneda: o.value }))}
                        />
                      ))}
                    </View>
                  </View>
                  <Input
                    label="País"
                    placeholder="Argentina"
                    value={form.pais}
                    onChangeText={(t) => set('pais')(fmtLetters(t))}
                  />
                </>
              )}

              {formError ? (
                <ThemedText type="caption" style={{ color: theme.danger }}>{formError}</ThemedText>
              ) : null}

              <Button
                title="Guardar método"
                onPress={onSubmit}
                loading={createM.isPending}
                disabled={!canSubmit}
                fullWidth
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: Spacing.three },
  col: { flex: 1 },
  content: { gap: Spacing.five, paddingVertical: Spacing.four, paddingBottom: Spacing.seven },
  section: { gap: Spacing.three },
  method: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  methodTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  methodIcon: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.two },
  addCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, borderWidth: 1, padding: Spacing.five, maxHeight: '92%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.two },
  form: { gap: Spacing.four, paddingBottom: Spacing.four },
  field: { gap: Spacing.two },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
