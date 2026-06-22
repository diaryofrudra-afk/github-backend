import { DocumentEditor } from './editor/DocumentEditor';

interface NewInvoiceEditorProps {
  mode: 'create' | 'edit';
  invoiceId?: string;
  invoiceNumber: string;
  onCancel: () => void;
  onSaved: () => void;
}

export function NewInvoiceEditor({ mode, invoiceId, invoiceNumber, onCancel, onSaved }: NewInvoiceEditorProps) {
  return (
    <DocumentEditor
      kind="invoice"
      mode={mode}
      documentId={invoiceId}
      defaultNumber={invoiceNumber}
      onCancel={onCancel}
      onSaved={onSaved}
    />
  );
}
