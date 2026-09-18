import { useRef, useState } from 'react';
import type { SavedPreset } from '../state/InstrumentPreset';
import { CollapsibleSection } from './CollapsibleSection';

interface PresetPanelProps {
  presets: SavedPreset[];
  selectedId: string | null;
  nameDraft: string;
  status: string | null;
  onNameDraftChange: (name: string) => void;
  onSelect: (id: string) => void;
  onSave: () => void;
  onLoad: () => void;
  onDelete: () => void;
  onExportSelected: () => void;
  onExportAll: () => void;
  onImportFiles: (files: FileList | null) => void;
}

export function PresetPanel({
  presets,
  selectedId,
  nameDraft,
  status,
  onNameDraftChange,
  onSelect,
  onSave,
  onLoad,
  onDelete,
  onExportSelected,
  onExportAll,
  onImportFiles,
}: PresetPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <CollapsibleSection
      mode="mobile"
      className="panel preset-panel"
      title="Presets"
      actions={<span className="panel-hint">{presets.length} saved</span>}
    >
      <div className="field">
        <label className="label" htmlFor="preset-name">
          Name
        </label>
        <input
          id="preset-name"
          type="text"
          value={nameDraft}
          placeholder="Preset name"
          onChange={(e) => onNameDraftChange(e.target.value)}
        />
      </div>

      <div className="field">
        <label className="label" htmlFor="preset-list">
          Library
        </label>
        <select
          id="preset-list"
          value={selectedId ?? ''}
          onChange={(e) => onSelect(e.target.value)}
        >
          <option value="" disabled>
            {presets.length === 0 ? 'No presets yet' : 'Select preset…'}
          </option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="preset-actions">
        <button type="button" className="btn btn-primary" onClick={onSave}>
          Save
        </button>
        <button
          type="button"
          className="btn"
          disabled={!selectedId}
          onClick={onLoad}
        >
          Load
        </button>
        <button
          type="button"
          className="btn"
          disabled={!selectedId}
          onClick={() => {
            if (!confirmDelete) {
              setConfirmDelete(true);
              return;
            }
            setConfirmDelete(false);
            onDelete();
          }}
          onBlur={() => setConfirmDelete(false)}
        >
          {confirmDelete ? 'Confirm?' : 'Delete'}
        </button>
      </div>

      <div className="preset-actions">
        <button
          type="button"
          className="btn"
          disabled={!selectedId}
          onClick={onExportSelected}
        >
          Export
        </button>
        <button
          type="button"
          className="btn"
          disabled={presets.length === 0}
          onClick={onExportAll}
        >
          Export All
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => fileRef.current?.click()}
        >
          Import
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          multiple
          hidden
          onChange={(e) => {
            onImportFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {status && <p className="preset-status">{status}</p>}
    </CollapsibleSection>
  );
}
