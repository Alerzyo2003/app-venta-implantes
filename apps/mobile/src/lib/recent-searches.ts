import AsyncStorage from '@react-native-async-storage/async-storage';

/** Búsquedas recientes guardadas solo en el dispositivo (BUS-06). */
const KEY = 'busquedas-recientes';
export const MAX_RECENT = 8;

export async function getRecentSearches(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function addRecent(list: string[], term: string): string[] {
  const t = term.trim();
  if (!t) return list;
  return [t, ...list.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, MAX_RECENT);
}

export async function saveRecentSearch(term: string): Promise<string[]> {
  const next = addRecent(await getRecentSearches(), term);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function clearRecentSearches(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
