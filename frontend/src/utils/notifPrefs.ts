import AsyncStorage from '@react-native-async-storage/async-storage';

export type NotifPrefs = {
  ventas: boolean;
  multas: boolean;
  solicitudes: boolean;
  medios_pago: boolean;
};

const DEFAULT_PREFS: NotifPrefs = {
  ventas: true,
  multas: true,
  solicitudes: true,
  medios_pago: true,
};

const KEY = 'bidify.notifPrefs';

export async function getNotifPrefs(): Promise<NotifPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<NotifPrefs>) };
  } catch {}
  return { ...DEFAULT_PREFS };
}

export async function saveNotifPrefs(prefs: NotifPrefs): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
}
