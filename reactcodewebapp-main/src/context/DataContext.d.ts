import type { ReactNode } from 'react';
import type { BlackbuckData } from '../types';
interface DataContextValue {
    blackbuck: BlackbuckData | null;
    blackbuckLoading: boolean;
    blackbuckError: string | null;
    refetchBlackbuck: () => void;
    setGpsActive: (active: boolean) => void;
}
export declare function DataProvider({ children }: {
    children: ReactNode;
}): import("react/jsx-runtime").JSX.Element;
export declare function useData(): DataContextValue;
export {};
//# sourceMappingURL=DataContext.d.ts.map