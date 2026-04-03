import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { BlackbuckData } from '../types';
import { useBlackbuck } from '../hooks/useBlackbuck';

interface DataContextValue {
  blackbuck: BlackbuckData | null;
  blackbuckLoading: boolean;
  blackbuckError: string | null;
  refetchBlackbuck: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { data, loading, error, refetch } = useBlackbuck();
  return (
    <DataContext.Provider value={{
      blackbuck: data,
      blackbuckLoading: loading,
      blackbuckError: error,
      refetchBlackbuck: refetch,
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
