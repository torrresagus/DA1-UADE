import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import type { CuentaCobroOut, MedioPagoOut, TipoMedioPago } from '@/api/types';
import {
  useCreateMedioPago,
  useCuentasCobro,
  useDeleteMedioPago,
  useMediosPago,
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

const TIPO_OPTIONS: { value: TipoMedioPago; label: string; icon: IconName }[] = [
  { value: 'tarjeta_credito', label: 'Tarjeta', icon: 'card' },
  { value: 'cuenta_bancaria', label: 'Cuenta bancaria', icon: 'business' },
  { value: 'cheque_certificado', label: 'Cheque', icon: 'document-text' },
];

function tipoMeta(tipo: TipoMedioPago): { label: string; icon: IconName } {
  return TIPO_OPTIONS.find((o) => o.value === tipo) ?? { label: tipo, icon: 'card' };
}

function statusBadge(m: MedioPagoOut): { label: string; tone: BadgeTone } {
  if (m.verificado) return { label: 'Verificado', tone: 'success' };
  if (m.estado === 'rechazado') return { label: 'Rechazado', tone: 'danger' };
  return { label: 'Pendiente', tone: 'gold' };
}

export default function PaymentsScreen() {
  const theme = useTheme();
  const { usuarioId } = useSession();

  const methods = useMediosPago(usuarioId);
  const createM = useCreateMedioPago(usuarioId ?? 0);
  const delM = useDeleteMedioPago(usuarioId ?? 0);
  const cuentas = useCuentasCobro(usuarioId);

  const [formOpen, setFormOpen] = useState(false);
  const [tipo, setTipo] = useState<TipoMedioPago>('tarjeta_credito');
  const [titular, setTitular] = useState('');
  const [detalle, setDetalle] = useState('');
  const [pais, setPais] = useState('Argentina');
  const [formError, setFormError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  if (usuarioId == null) {
    return (
      <Screen padded>
        <ScreenHeader title="Cartera & Pagos" />
        <EmptyState icon="person-circle-outline" message="Iniciá sesión para gestionar tus métodos de pago" />
      </Screen>
    );
  }

  const resetForm = () => {
    setTipo('tarjeta_credito');
    setTitular('');
    setDetalle('');
    setPais('Argentina');
    setFormError(null);
  };

  const closeForm = () => {
    setFormOpen(false);
    resetForm();
  };

  const onSubmit = async () => {
    setFormError(null);
    try {
      await createM.mutateAsync({ tipo, titular: titular.trim(), detalle: detalle.trim(), pais: pais.trim() });
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

  const canSubmit = titular.trim().length > 0 && detalle.trim().length > 0 && pais.trim().length > 0;

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
              message={methods.error instanceof ApiError ? methods.error.detail : 'No se pudieron cargar tus métodos de pago'}
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
                    onPress={() => onDelete(m.id)}
                    disabled={delM.isPending}
                    icon={<Icon name="trash-outline" size={18} color={theme.danger} />}
                    style={styles.deleteBtn}
                  />
                </Card>
              );
            })
          )}

          {rowError ? (
            <ThemedText type="caption" style={{ color: theme.danger }}>
              {rowError}
            </ThemedText>
          ) : null}

          <Card onPress={() => setFormOpen(true)} style={styles.addCard}>
            <Icon name="add-circle-outline" size={20} color={theme.primary} />
            <ThemedText type="smallBold" style={{ color: theme.primary }}>
              Agregar método de pago
            </ThemedText>
          </Card>
        </View>

        <View style={styles.section}>
          <ThemedText type="heading">Cuentas bancarias</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            Donde acreditamos el cobro de tus ventas.
          </ThemedText>
          {cuentas.isLoading ? (
            <LoadingState inline />
          ) : cuentas.isError ? (
            <ErrorState message="No se pudieron cargar tus cuentas." onRetry={cuentas.refetch} />
          ) : (cuentas.data?.length ?? 0) === 0 ? (
            <EmptyState icon="business-outline" message="No tenés cuentas bancarias declaradas" />
          ) : (
            cuentas.data!.map((c: CuentaCobroOut) => (
              <Card key={c.id} style={styles.method}>
                <View style={[styles.methodIcon, { backgroundColor: theme.cardElevated }]}>
                  <Icon name="business" size={20} color={theme.primary} />
                </View>
                <View style={styles.flex}>
                  <ThemedText type="smallBold">{c.banco}</ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {c.numero_cuenta} · {c.titular}
                  </ThemedText>
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={formOpen} transparent animationType="slide" onRequestClose={closeForm}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="heading">Agregar método de pago</ThemedText>
              <Button
                title=""
                variant="ghost"
                size="sm"
                onPress={closeForm}
                icon={<Icon name="close" size={20} color={theme.textSecondary} />}
                style={styles.deleteBtn}
              />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.form}>
              <View style={styles.field}>
                <ThemedText type="caption" themeColor="textSecondary">
                  Tipo
                </ThemedText>
                <View style={styles.tipoRow}>
                  {TIPO_OPTIONS.map((o) => (
                    <Chip key={o.value} label={o.label} active={tipo === o.value} onPress={() => setTipo(o.value)} />
                  ))}
                </View>
              </View>

              <Input label="Titular" placeholder="Nombre del titular" value={titular} onChangeText={setTitular} />
              <Input label="Detalle" placeholder="•••• 4242 / CBU / Nº cheque" value={detalle} onChangeText={setDetalle} />
              <Input label="País" placeholder="Argentina" value={pais} onChangeText={setPais} />

              {formError ? (
                <ThemedText type="caption" style={{ color: theme.danger }}>
                  {formError}
                </ThemedText>
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
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: Spacing.five, paddingVertical: Spacing.four, paddingBottom: Spacing.seven },
  section: { gap: Spacing.three },
  method: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  methodTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  methodIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.two },
  addCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.five,
    maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  form: { gap: Spacing.four, paddingTop: Spacing.four },
  field: { gap: Spacing.two },
  tipoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
