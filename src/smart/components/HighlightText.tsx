import React, { useMemo } from 'react';
import { cn } from '../../lib/utils';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function HighlightText({
  text,
  query,
  className,
  highlightClassName,
}: {
  text: string;
  query: string;
  className?: string;
  highlightClassName?: string;
}) {
  const parts = useMemo(() => {
    const q = query.trim();
    if (!q) return [{ str: text, hit: false }];
    const tokens = [...new Set(q.split(/\s+/).filter((t) => t.length >= 1))];
    if (tokens.length === 0) return [{ str: text, hit: false }];
    const pattern = tokens.map(escapeRegExp).join('|');
    try {
      const re = new RegExp(`(${pattern})`, 'gi');
      const out: { str: string; hit: boolean }[] = [];
      let last = 0;
      let m: RegExpExecArray | null;
      const r = new RegExp(re.source, re.flags);
      while ((m = r.exec(text)) !== null) {
        if (m.index > last) out.push({ str: text.slice(last, m.index), hit: false });
        out.push({ str: m[0], hit: true });
        last = m.index + m[0].length;
      }
      if (last < text.length) out.push({ str: text.slice(last), hit: false });
      return out.length ? out : [{ str: text, hit: false }];
    } catch {
      return [{ str: text, hit: false }];
    }
  }, [text, query]);

  return (
    <span className={cn('inline', className)} dir="auto">
      {parts.map((p, i) =>
        p.hit ? (
          <mark
            key={i}
            className={cn(
              'rounded px-0.5 bg-amber-200/90 dark:bg-amber-500/35 text-inherit',
              highlightClassName
            )}
          >
            {p.str}
          </mark>
        ) : (
          <span key={i}>{p.str}</span>
        )
      )}
    </span>
  );
}
