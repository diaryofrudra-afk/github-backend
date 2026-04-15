interface TrakNTellCredentials {
    configured: boolean;
    user_id_preview: string;
    updated_at?: string;
    has_sessionid?: boolean;
}
interface TrakNTellHealth {
    configured: boolean;
    user_id_preview: string;
    vehicle_count: number;
    last_error: string;
}
export declare function useTrakNTellSettings(): {
    credentials: TrakNTellCredentials | null;
    health: TrakNTellHealth | null;
    error: string | null;
    saving: boolean;
    fetchCredentials: () => Promise<void>;
    fetchHealth: () => Promise<void>;
    saveCredentials: (user_id: string, user_id_encrypt: string, orgid: string, sessionid?: string, tnt_s?: string) => Promise<boolean>;
    deleteCredentials: () => Promise<boolean>;
    setError: import("react").Dispatch<import("react").SetStateAction<string | null>>;
};
export {};
//# sourceMappingURL=useTrakNTellSettings.d.ts.map