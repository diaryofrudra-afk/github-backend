export declare function safeLoad<T>(key: string, defaultValue: T): T;
export declare function saveKey(key: string, value: unknown): void;
export declare const cleanPhone: (v: unknown) => string;
export declare const esc: (s: unknown) => string;
export declare const fmtINR: (n: number) => string;
export declare function fmt12(t: string): string;
export declare function calcHours(s: string, e: string): number | null;
export declare function fmtHours(h: number | null | undefined): string;
export declare function todayStr(): string;
export declare function todayISO(): string;
/** Format an ISO date string (YYYY-MM-DD) as dd/mm/yyyy */
export declare function fmtDate(d: string | undefined): string;
/** Normalize any date string to ISO (YYYY-MM-DD) format */
export declare function toISO(d: string): string;
export declare function getExpiryStatus(d: string | undefined): {
    l: string;
    c: string;
};
export interface BillResult {
    total: number;
    subtotal: number;
    sgst: number;
    cgst: number;
    gst: number;
    standard: number;
    ot: number;
    stdH: number;
    otH: number;
    rate: number;
    otRate: number;
    hasOT: boolean;
}
export declare function calcBill(h: number, crane: {
    rate: number;
    dailyLimit?: number;
    otRate?: number;
} | null, acc?: number): BillResult | null;
//# sourceMappingURL=index.d.ts.map