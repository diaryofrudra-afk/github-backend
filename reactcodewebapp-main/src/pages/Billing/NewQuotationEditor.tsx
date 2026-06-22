import { DocumentEditor } from './editor/DocumentEditor';

interface NewQuotationEditorProps {
  mode: 'create' | 'edit';
  quotationId?: string;
  quotationNumber: string;
  onCancel: () => void;
  onSaved: () => void;
}

export function NewQuotationEditor({ mode, quotationId, quotationNumber, onCancel, onSaved }: NewQuotationEditorProps) {
  return (
    <DocumentEditor
      kind="quotation"
      mode={mode}
      documentId={quotationId}
      defaultNumber={quotationNumber}
      onCancel={onCancel}
      onSaved={onSaved}
    />
  );
}
