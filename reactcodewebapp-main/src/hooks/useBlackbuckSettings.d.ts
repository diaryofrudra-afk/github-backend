interface BlackbuckSettings {
    configured: boolean;
    token_preview: string;
    fleet_owner_id: string;
    updated_at?: string;
}
interface BlackbuckHealth {
    configured: boolean;
    token_preview: string;
    fleet_owner_id: string;
    vehicle_count: number;
    last_error: string;
}
export declare function useBlackbuckSettings(): {
    credentials: BlackbuckSettings | null;
    health: BlackbuckHealth | null;
    loading: boolean;
    error: string | null;
    saving: boolean;
    fetchCredentials: () => Promise<void>;
    fetchHealth: () => Promise<void>;
    saveCredentials: (auth_token: string, fleet_owner_id: string) => Promise<boolean>;
    deleteCredentials: () => Promise<boolean>;
    setError: import("react").Dispatch<import("react").SetStateAction<string | null>>;
};
export {};
//# sourceMappingURL=useBlackbuckSettings.d.ts.map