import type { SupabaseClient } from '@supabase/supabase-js';
import type { DepartmentCode } from '../data/department';

function isMissingFunctionError(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes('could not find the function') || m.includes('function') && m.includes('schema cache');
}

function mergeRpcParams(
  base: Record<string, unknown>,
  override: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (override == null || Object.keys(override).length === 0) return base;
  return { ...base, ...override };
}

export async function rpcWithInstallationFallback<TData>(
  client: SupabaseClient,
  args: {
    department: DepartmentCode;
    installationRpc: string;
    defaultRpc: string;
    /** يُدمج مع المعاملات الخاصة بالقسم عند الحاجة */
    params?: Record<string, unknown>;
    /** معاملات دالة التركيب (مثلاً p_day بدل p_date) */
    installationParams?: Record<string, unknown>;
    /** معاملات دالة التجهيز الافتراضية */
    defaultParams?: Record<string, unknown>;
  }
): Promise<{ data: TData | null; error: { message: string } | null }> {
  const {
    department,
    installationRpc,
    defaultRpc,
    params = {},
    installationParams,
    defaultParams,
  } = args;
  const preferred = department === 'installation' ? installationRpc : defaultRpc;
  const fallback = defaultRpc;

  const primaryPayload =
    department === 'installation'
      ? mergeRpcParams(params, installationParams)
      : mergeRpcParams(params, defaultParams);

  const first = await client.rpc(preferred, primaryPayload);
  if (!first.error) return { data: (first.data as TData) ?? null, error: null };

  if (department !== 'installation' || preferred === fallback || !isMissingFunctionError(first.error.message)) {
    return { data: null, error: { message: first.error.message } };
  }

  const fallbackPayload = mergeRpcParams(params, defaultParams);
  const second = await client.rpc(fallback, fallbackPayload);
  if (second.error) return { data: null, error: { message: second.error.message } };
  return { data: (second.data as TData) ?? null, error: null };
}

