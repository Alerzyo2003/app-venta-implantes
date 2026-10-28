import type { BusinessHours } from '@repo/domain';
import { useQuery } from '@tanstack/react-query';

import { getSupabase, supabase } from '@/lib/supabase';

export interface PublicSettings {
  catalogVisibility: 'public' | 'authenticated';
  pricingVisibility: 'public' | 'authenticated' | 'verified_professionals';
  ivaRate: number;
  reservationMinutes: number;
  whatsapp: string | null;
  businessHours: BusinessHours[];
  supportEmail: string | null;
  minVersion: { ios?: string; android?: string };
}

const DEFAULTS: PublicSettings = {
  catalogVisibility: 'public',
  pricingVisibility: 'authenticated',
  ivaRate: 0.19,
  reservationMinutes: 30,
  whatsapp: null,
  businessHours: [],
  supportEmail: null,
  minVersion: {},
};

/** Configuración pública del negocio (contacto, visibilidad, versión mínima). */
export function usePublicSettings() {
  return useQuery({
    queryKey: ['public-settings'],
    enabled: !!supabase,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PublicSettings> => {
      const { data, error } = await getSupabase().from('app_settings').select('key, value').eq('is_public', true);
      if (error) throw error;
      const map = new Map((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));
      const get = <T,>(key: string, fallback: T): T => (map.has(key) && map.get(key) !== null ? (map.get(key) as T) : fallback);
      return {
        catalogVisibility: get('catalog.visibility', DEFAULTS.catalogVisibility),
        pricingVisibility: get('pricing.visibility', DEFAULTS.pricingVisibility),
        ivaRate: Number(get('tax.iva_rate', DEFAULTS.ivaRate)),
        reservationMinutes: Number(get('checkout.reservation_minutes', DEFAULTS.reservationMinutes)),
        whatsapp: get<string | null>('contact.whatsapp', null),
        businessHours: get<BusinessHours[]>('contact.business_hours', []),
        supportEmail: get<string | null>('contact.support_email', null),
        minVersion: get('app.min_supported_version', {}),
      };
    },
  });
}

export interface LegalDocument {
  id: string;
  kind: 'terms' | 'privacy';
  version: string;
  title: string;
  url: string;
}

export function useCurrentLegalDocuments() {
  return useQuery({
    queryKey: ['legal-documents'],
    enabled: !!supabase,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<LegalDocument[]> => {
      const { data, error } = await getSupabase()
        .from('legal_documents')
        .select('id, kind, version, title, url')
        .eq('is_current', true);
      if (error) throw error;
      return (data ?? []) as LegalDocument[];
    },
  });
}
