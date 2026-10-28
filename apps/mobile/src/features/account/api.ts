import type { AccountType, AddressData, BillingProfileData, Profession } from '@repo/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { getSupabase, supabase } from '@/lib/supabase';

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  account_type: AccountType;
  professional_status: 'not_requested' | 'pending' | 'verified' | 'rejected';
  rut: string | null;
}

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['profile', user?.id],
    enabled: !!supabase && !!user,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await getSupabase()
        .from('profiles')
        .select('id, full_name, phone, account_type, professional_status, rut')
        .eq('id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });
}

export function useUpdateProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { fullName: string; phone: string }) => {
      const { error } = await getSupabase()
        .from('profiles')
        .update({ full_name: input.fullName, phone: input.phone })
        .eq('id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });
}

export interface Region {
  code: string;
  name: string;
  short_name: string;
  ordinal: number;
}
export interface Comuna {
  code: string;
  name: string;
  region_code: string;
}

/** Regiones y comunas oficiales (CUT). Datos de referencia: se guardan en caché largo tiempo. */
export function useTerritory() {
  return useQuery({
    queryKey: ['territory'],
    enabled: !!supabase,
    staleTime: 24 * 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    queryFn: async () => {
      const client = getSupabase();
      const [regions, comunas] = await Promise.all([
        client.from('regions').select('code, name, short_name, ordinal').order('ordinal'),
        client.from('comunas').select('code, name, region_code').order('name'),
      ]);
      if (regions.error) throw regions.error;
      if (comunas.error) throw comunas.error;
      return { regions: (regions.data ?? []) as Region[], comunas: (comunas.data ?? []) as Comuna[] };
    },
  });
}

export interface Address {
  id: string;
  label: string | null;
  recipient_name: string;
  phone: string;
  street: string;
  street_number: string;
  unit: string | null;
  comuna_code: string;
  reference: string | null;
  is_default: boolean;
  comuna: { name: string; region_code: string } | null;
}

export function useAddresses() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['addresses', user?.id],
    enabled: !!supabase && !!user,
    queryFn: async (): Promise<Address[]> => {
      const { data, error } = await getSupabase()
        .from('addresses')
        .select('id, label, recipient_name, phone, street, street_number, unit, comuna_code, reference, is_default, comuna:comunas!addresses_comuna_code_fkey(name, region_code)')
        .eq('user_id', user!.id)
        .is('archived_at', null)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Address[];
    },
  });
}

export function useSaveAddress() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: AddressData }) => {
      const row = {
        user_id: user!.id,
        label: input.label || null,
        recipient_name: input.recipientName,
        phone: input.phone,
        street: input.street,
        street_number: input.streetNumber,
        unit: input.unit || null,
        comuna_code: input.comunaCode,
        reference: input.reference || null,
        is_default: input.isDefault,
      };
      const client = getSupabase();
      const { error } = id ? await client.from('addresses').update(row).eq('id', id) : await client.from('addresses').insert(row);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['addresses'] }),
  });
}

export function useArchiveAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase()
        .from('addresses')
        .update({ archived_at: new Date().toISOString(), is_default: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['addresses'] }),
  });
}

export interface BillingProfile {
  id: string;
  rut: string;
  business_name: string;
  giro: string;
  address_line: string;
  comuna_code: string;
  dte_email: string;
  is_default: boolean;
}

export function useBillingProfiles() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['billing-profiles', user?.id],
    enabled: !!supabase && !!user,
    queryFn: async (): Promise<BillingProfile[]> => {
      const { data, error } = await getSupabase()
        .from('billing_profiles')
        .select('id, rut, business_name, giro, address_line, comuna_code, dte_email, is_default')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as BillingProfile[];
    },
  });
}

export function useSaveBillingProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: BillingProfileData }) => {
      const row = {
        user_id: user!.id,
        rut: input.rut,
        business_name: input.businessName,
        giro: input.giro,
        address_line: input.addressLine,
        comuna_code: input.comunaCode,
        dte_email: input.dteEmail,
      };
      const client = getSupabase();
      const { error } = id
        ? await client.from('billing_profiles').update(row).eq('id', id)
        : await client.from('billing_profiles').insert(row);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['billing-profiles'] }),
  });
}

export function useDeleteBillingProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().from('billing_profiles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['billing-profiles'] }),
  });
}

export interface Verification {
  id: string;
  profession: Profession;
  rut: string;
  registry_number: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  submitted_at: string;
  review_notes: string | null;
}

export function useMyVerification() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['verification', user?.id],
    enabled: !!supabase && !!user,
    queryFn: async (): Promise<Verification | null> => {
      const { data, error } = await getSupabase()
        .from('professional_verifications')
        .select('id, profession, rut, registry_number, status, submitted_at, review_notes')
        .eq('user_id', user!.id)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Verification | null;
    },
  });
}

export function useSubmitVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { profession: Profession; rut: string; registryNumber: string }) => {
      const { error } = await getSupabase().rpc('submit_professional_verification', {
        p_profession: input.profession,
        p_rut: input.rut,
        p_registry_number: input.registryNumber,
        p_document_paths: [],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verification'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export type MarketingChannel = 'marketing_email' | 'marketing_push' | 'marketing_whatsapp';

export function useConsents() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['consents', user?.id],
    enabled: !!supabase && !!user,
    queryFn: async (): Promise<Record<string, { granted: boolean; created_at: string }>> => {
      const { data, error } = await getSupabase()
        .from('current_consents')
        .select('consent_type, granted, created_at')
        .eq('user_id', user!.id);
      if (error) throw error;
      return Object.fromEntries(
        ((data ?? []) as { consent_type: string; granted: boolean; created_at: string }[]).map((c) => [
          c.consent_type,
          { granted: c.granted, created_at: c.created_at },
        ]),
      );
    },
  });
}

/** Cada cambio queda en el historial de consentimientos (no se sobrescribe). */
export function useSetMarketingConsent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ channel, granted }: { channel: MarketingChannel; granted: boolean }) => {
      const { error } = await getSupabase()
        .from('consents')
        .insert({ user_id: user!.id, consent_type: channel, granted, source: 'app' });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['consents'] }),
  });
}

export function useAcceptCurrentLegal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await getSupabase().rpc('accept_current_legal_documents', { p_source: 'app' });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['consents'] }),
  });
}

/** CTA-12: elimina la cuenta en el servidor y cierra la sesión local. */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      const client = getSupabase();
      const { error } = await client.rpc('delete_my_account');
      if (error) throw error;
      await client.auth.signOut({ scope: 'local' });
    },
  });
}
