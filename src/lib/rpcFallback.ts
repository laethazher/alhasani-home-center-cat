import type { SupabaseClient } from '@supabase/supabase-js';
import type { DepartmentCode } from '../data/department';

function isMissingFunctionError(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes('could not find the function') || m.includes('function') && m.includes('schema cache');
}

export async function rpcWithInstallationFallback<TData>(
  client: SupabaseClient,
  args: {
    department: DepartmentCode;
    installationRpc: string;
    defaultRpc: string;
    params?: Record<string, unknown>;
  }
): Promise<{ data: TData | null; error: { message: string } | null }> {
  const { department, installationRpc, defaultRpc, params } = args;
  const preferred = department === 'installation' ? installationRpc : defaultRpc;
  const fallback = defaultRpc;

  const first = await client.rpc(preferred, params ?? {});
  if (!first.error) return { data: (first.data as TData) ?? null, error: null };

  if (department !== 'installation' || preferred === fallback || !isMissingFunctionError(first.error.message)) {
    return { data: null, error: { message: first.error.message } };
  }

  const second = await client.rpc(fallback, params ?? {});
  if (second.error) return { data: null, error: { message: second.error.message } };
  return { data: (second.data as TData) ?? null, error: null };
}

