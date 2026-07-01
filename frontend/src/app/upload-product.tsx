import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { fmtMoneyInput } from '@/utils/format';
import { PRODUCT_CATEGORIES } from '@/api/categories';
import type { Moneda } from '@/api/types';
import { pickAndUploadMultipleAsync } from '@/api/upload';
import { useCrearSolicitud } from '@/api/hooks/useSolicitudes';
import type { SolicitudCreate } from '@/api/types';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/states';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/context/session';

// Las fotos se eligen de la galería y se suben al storage local del backend
// (POST /uploads), que devuelve la URL guardada en la solicitud.
const MIN_IMAGES = 6; // el enunciado exige al menos 6 fotos del bien
const MAX_IMAGES = 8;

export default function UploadProductScreen() {
  const theme = useTheme();
  const { usuarioId } = useSession();
  const crear = useCrearSolicitud(usuarioId!);

  const [form, setForm] = useState({ title: '', price: '', description: '', cantidad: '' });
  const [esMultiple, setEsMultiple] = useState(false);
  const [moneda, setMoneda] = useState<Moneda>('ARS');
  const [category, setCategory] = useState<string>(PRODUCT_CATEGORIES[0]);
  const [images, setImages] = useState<string[]>([]);
  const [declaraPropiedad, setDeclaraPropiedad] = useState(false);
  const [aceptaDevolucion, setAceptaDevolucion] = useState(false);
  const [origenLicito, setOrigenLicito] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Guard: a solicitud is tied to a user identity. If there is no session, the
  // create hook is disabled; show a login prompt instead of a broken form.
  if (usuarioId == null) {
    return (
      <Screen padded>
        <ScreenHeader title="Cargar producto" />
        <EmptyState icon="person-outline" message="Iniciá sesión para cargar un producto." />
      </Screen>
    );
  }

  const addPhoto = async () => {
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0 || uploading) return;
    setUploading(true);
    setUploadProgress(null);
    setError(null);
    try {
      const urls = await pickAndUploadMultipleAsync(remaining, (done, total) => {
        setUploadProgress({ done, total });
      });
      if (urls.length) setImages((prev) => [...prev, ...urls]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir la imagen.');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const canSubmit = declaraPropiedad && aceptaDevolucion && images.length >= MIN_IMAGES;

  const submit = async () => {
    setError(null);
    const { title, price, description, cantidad } = form;
    const descripcion =
      (title ? title + ' — ' : '') +
      description +
      (price ? ` (precio sugerido: ${price} ${moneda})` : '');

    const cantidadElementos = esMultiple ? Math.max(2, parseInt(cantidad) || 2) : 1;

    const body: SolicitudCreate = {
      descripcion,
      datos_historicos: category,
      declara_propiedad: declaraPropiedad,
      origen_licito_acreditado: origenLicito,
      acepta_devolucion_con_cargo: aceptaDevolucion,
      cantidad_elementos: cantidadElementos,
      imagenes: images.map((url, i) => ({ url, orden: i + 1 })),
    };

    try {
      const sol = await crear.mutateAsync(body);
      router.replace({ pathname: '/product-status', params: { id: String(sol.id) } });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Ocurrió un error');
    }
  };

  return (
    <Screen padded>
      <ScreenHeader title="Cargar producto" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <Pressable
          onPress={addPhoto}
          disabled={uploading || images.length >= MAX_IMAGES}
          style={[styles.upload, { borderColor: theme.borderStrong, backgroundColor: theme.card }]}>
          <View style={[styles.uploadIcon, { backgroundColor: theme.primaryGlow }]}>
            <Icon name={uploading ? 'cloud-upload-outline' : 'camera-outline'} size={28} color={theme.primary} />
          </View>
          <ThemedText type="smallBold">
            {uploadProgress
              ? `Subiendo ${uploadProgress.done} de ${uploadProgress.total}…`
              : uploading
                ? 'Subiendo…'
                : images.length
                  ? `${images.length} de ${MAX_IMAGES} fotos`
                  : 'Agregar fotos'}
          </ThemedText>
          <ThemedText
            type="caption"
            style={{ color: images.length < MIN_IMAGES ? theme.warning : theme.textSecondary }}>
            {images.length < MIN_IMAGES
              ? `Mínimo ${MIN_IMAGES} fotos (faltan ${MIN_IMAGES - images.length})`
              : 'Tocá para agregar más'}
          </ThemedText>
        </Pressable>

        {images.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
            {images.map((uri, i) => (
              <View key={`${uri}-${i}`}>
                <Image source={{ uri }} style={styles.thumb} contentFit="cover" />
                <Pressable
                  onPress={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                  style={[styles.thumbRemove, { backgroundColor: theme.danger }]}>
                  <Icon name="close" size={12} color="#FFFFFF" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}

        <Input label="Título" placeholder="Nombre del producto" value={form.title} onChangeText={set('title')} />

        <View style={styles.section}>
          <ThemedText type="caption" themeColor="textSecondary">
            Categoría
          </ThemedText>
          <View style={styles.cats}>
            {PRODUCT_CATEGORIES.map((c) => {
              const active = category === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[
                    styles.cat,
                    {
                      backgroundColor: active ? theme.primary : theme.cardElevated,
                      borderColor: active ? theme.primary : theme.border,
                    },
                  ]}>
                  <ThemedText
                    type="smallBold"
                    style={{ color: active ? theme.onPrimary : theme.textSecondary }}>
                    {c}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Input
          label="Precio sugerido"
          placeholder="0"
          keyboardType="numeric"
          value={form.price}
          onChangeText={(t) => set('price')(fmtMoneyInput(t))}
          leading={<Icon name="pricetag-outline" size={18} color={theme.textSecondary} />}
        />
        <View style={styles.section}>
          <ThemedText type="caption" themeColor="textSecondary">
            Moneda del precio sugerido
          </ThemedText>
          <View style={styles.cats}>
            {(['ARS', 'USD'] as const).map((m) => {
              const active = moneda === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => setMoneda(m)}
                  style={[
                    styles.cat,
                    {
                      backgroundColor: active ? theme.primary : theme.cardElevated,
                      borderColor: active ? theme.primary : theme.border,
                    },
                  ]}>
                  <ThemedText
                    type="smallBold"
                    style={{ color: active ? theme.onPrimary : theme.textSecondary }}>
                    {m === 'ARS' ? 'ARS (Pesos)' : 'USD (Dólares)'}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
        <Input
          label="Descripción"
          placeholder="Describe el estado, año, procedencia..."
          multiline
          numberOfLines={4}
          style={styles.textArea}
          value={form.description}
          onChangeText={set('description')}
          onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150)}
        />

        <View style={styles.section}>
          <ThemedText type="caption" themeColor="textSecondary">
            Cantidad de elementos
          </ThemedText>
          <CheckRow
            label="Este producto está formado por más de un elemento (ej: juego de 18 piezas)"
            checked={esMultiple}
            onToggle={() => {
              setEsMultiple((v) => !v);
              if (esMultiple) setForm((f) => ({ ...f, cantidad: '' }));
            }}
          />
          {esMultiple ? (
            <Input
              label="¿Cuántos elementos?"
              placeholder="2"
              keyboardType="numeric"
              value={form.cantidad}
              onChangeText={(t) => setForm((f) => ({ ...f, cantidad: t.replace(/\D/g, '') }))}
            />
          ) : null}
        </View>

        <View style={styles.section}>
          <ThemedText type="caption" themeColor="textSecondary">
            Declaraciones
          </ThemedText>
          <CheckRow
            label="Declaro ser el propietario del bien"
            checked={declaraPropiedad}
            onToggle={() => setDeclaraPropiedad((v) => !v)}
          />
          <CheckRow
            label="Acepto la devolución con cargo si corresponde"
            checked={aceptaDevolucion}
            onToggle={() => setAceptaDevolucion((v) => !v)}
          />
          <CheckRow
            label="El origen lícito está acreditado"
            checked={origenLicito}
            onToggle={() => setOrigenLicito((v) => !v)}
          />
        </View>

        {error ? (
          <ThemedText type="small" style={{ color: theme.danger }}>
            {error}
          </ThemedText>
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>

      <Button
        title="Publicar para revisión"
        fullWidth
        style={styles.cta}
        disabled={!canSubmit}
        loading={crear.isPending}
        onPress={submit}
      />
    </Screen>
  );
}

function CheckRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onToggle} style={styles.checkRow}>
      <View
        style={[
          styles.checkbox,
          {
            backgroundColor: checked ? theme.primary : theme.cardElevated,
            borderColor: checked ? theme.primary : theme.border,
          },
        ]}>
        {checked ? <Icon name="checkmark" size={14} color={theme.onPrimary} /> : null}
      </View>
      <ThemedText type="small" style={styles.checkLabel}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: Spacing.four, paddingVertical: Spacing.four, paddingBottom: Spacing.six },
  upload: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    paddingVertical: Spacing.six,
    alignItems: 'center',
    gap: Spacing.two,
  },
  uploadIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  thumbs: { gap: Spacing.two, paddingVertical: Spacing.one },
  thumb: { width: 72, height: 72, borderRadius: Radius.sm, backgroundColor: '#0E121A' },
  thumbRemove: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { gap: Spacing.three },
  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  cat: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkLabel: { flex: 1 },
  cta: { marginBottom: Spacing.four },
});
