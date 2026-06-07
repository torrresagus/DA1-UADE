import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { PRODUCT_CATEGORIES } from '@/api/categories';
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

// NOTE: the backend SolicitudCreate takes image URLs only — there is NO file
// upload endpoint. The "Agregar fotos" picker therefore cannot upload device
// images; instead it appends a placeholder URL per tap so the request still
// carries imagenes. Swap this for a real uploader if/when the backend gains one.
const PLACEHOLDER_IMAGE = 'https://placehold.co/600x400?text=Producto';
const MIN_IMAGES = 6; // el enunciado exige al menos 6 fotos del bien
const MAX_IMAGES = 8;

export default function UploadProductScreen() {
  const theme = useTheme();
  const { usuarioId } = useSession();
  const crear = useCrearSolicitud(usuarioId!);

  const [form, setForm] = useState({ title: '', price: '', description: '' });
  const [category, setCategory] = useState<string>(PRODUCT_CATEGORIES[0]);
  const [images, setImages] = useState<string[]>([]);
  const [declaraPropiedad, setDeclaraPropiedad] = useState(false);
  const [aceptaDevolucion, setAceptaDevolucion] = useState(false);
  const [origenLicito, setOrigenLicito] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const addPhoto = () => {
    setImages((prev) => (prev.length >= MAX_IMAGES ? prev : [...prev, PLACEHOLDER_IMAGE]));
  };

  const canSubmit = declaraPropiedad && aceptaDevolucion && images.length >= MIN_IMAGES;

  const submit = async () => {
    setError(null);
    const { title, price, description } = form;
    const descripcion =
      (title ? title + ' — ' : '') +
      description +
      (price ? ' (precio sugerido: ' + price + ')' : '');

    const body: SolicitudCreate = {
      descripcion,
      datos_historicos: null,
      declara_propiedad: declaraPropiedad,
      origen_licito_acreditado: origenLicito,
      acepta_devolucion_con_cargo: aceptaDevolucion,
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Pressable
          onPress={addPhoto}
          style={[styles.upload, { borderColor: theme.borderStrong, backgroundColor: theme.card }]}>
          <View style={[styles.uploadIcon, { backgroundColor: theme.primaryGlow }]}>
            <Icon name="camera-outline" size={28} color={theme.primary} />
          </View>
          <ThemedText type="smallBold">
            {images.length ? `${images.length} de ${MAX_IMAGES} fotos` : 'Agregar fotos'}
          </ThemedText>
          <ThemedText
            type="caption"
            style={{ color: images.length < MIN_IMAGES ? theme.warning : theme.textSecondary }}>
            {images.length < MIN_IMAGES
              ? `Mínimo ${MIN_IMAGES} fotos (faltan ${MIN_IMAGES - images.length})`
              : 'Se adjunta una imagen de muestra (sin carga de archivos)'}
          </ThemedText>
        </Pressable>

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
          placeholder="$0"
          keyboardType="numeric"
          value={form.price}
          onChangeText={set('price')}
          leading={<Icon name="pricetag-outline" size={18} color={theme.textSecondary} />}
        />
        <Input
          label="Descripción"
          placeholder="Describe el estado, año, procedencia..."
          multiline
          numberOfLines={4}
          style={styles.textArea}
          value={form.description}
          onChangeText={set('description')}
        />

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
