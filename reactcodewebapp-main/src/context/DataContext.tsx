import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { BlackbuckData } from '../types';
import { useBlackbuck } from '../hooks/useBlackbuck';

interface DataContextValue {
  blackbuck: BlackbuckData | null;
  blackbuckLoading: boolean;
  blackbuckError: string | null;
  refetchBlackbuck: () => void;
  setGpsActive: (active: boolean) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  // Default: not active (will be overridden by GPS page)
  const [active, setActive] = useState(false);
  const { data, loading, error, refetch } = useBlackbuck(active);
  return (
    <DataContext.Provider value={{
      blackbuck: data,
      blackbuckLoading: loading,
      blackbuckError: error,
      refetchBlackbuck: refetch,
      setGpsActive: setActive,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
