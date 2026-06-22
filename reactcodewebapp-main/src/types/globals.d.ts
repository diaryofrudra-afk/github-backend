declare const XLSX: {
  utils: {
    book_new: () => unknown;
    aoa_to_sheet: (data: unknown[][]) => unknown;
    book_append_sheet: (wb: unknown, ws: unknown, name: string) => void;
  };
  writeFile: (wb: unknown, filename: string) => void;
};

declare const jspdf: {
  jsPDF: new (opts?: unknown) => {
    autoTable: (opts: unknown) => void;
    save: (filename: string) => void;
    text: (text: string, x: number, y: number) => void;
    setFontSize: (size: number) => void;
  };
};
