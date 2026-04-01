import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const installationUrl = import.meta.env.VITE_SUPABASE_URL_INSTALLATION as string | undefined;
const installationAnon = import.meta.env.VITE_SUPABASE_ANON_KEY_INSTALLATION as string | undefined;
const installationEnabled = (import.meta.env.VITE_SUPABASE_ENABLED_INSTALLATION as string | undefined) !== 'false';

let installationClient: SupabaseClient | null = null;

if (installationEnabled && installationUrl && installationAnon) {
  installationClient = createClient(installationUrl, installationAnon, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

export function getInstallationSupabaseClient(): SupabaseClient {
  if (!installationClient) {
    throw new Error(
      'Installation Supabase client is not configured. Set VITE_SUPABASE_URL_INSTALLATION and VITE_SUPABASE_ANON_KEY_INSTALLATION.'
    );
  }
  return installationClient;
}

export function hasInstallationSupabaseClient(): boolean {
  return Boolean(installationClient);
}
