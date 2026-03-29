import React, { createContext, useContext, useMemo } from 'react';
import type { PageKey } from '../types';

const SmartPageContext = createContext<PageKey>('dashboard');

export function SmartPageProvider({
  pageKey,
  children,
}: {
  pageKey: PageKey;
  children: React.ReactNode;
}) {
  const v = useMemo(() => pageKey, [pageKey]);
  return <SmartPageContext.Provider value={v}>{children}</SmartPageContext.Provider>;
}

export function useSmartPageKey(): PageKey {
  return useContext(SmartPageContext);
}
