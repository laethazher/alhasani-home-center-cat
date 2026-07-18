import { useEffect, useRef } from 'react';

/**
 * استدعاء refetch دوري — لا يغيّر منطق الجلب، فقط يستدعي الدالة الممررة.
 */
export function useAutoRefresh(intervalMs: number, refetch: () => void | Promise<void>, enabled = true) {
  const ref = useRef(refetch);
  ref.current = refetch;

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;
    const id = window.setInterval(() => {
      void Promise.resolve(ref.current());
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, enabled]);
}
