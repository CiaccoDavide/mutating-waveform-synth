import { useRef, useState } from 'react';
import type { SavedPreset } from '../state/InstrumentPreset';
import { CollapsibleSection } from './CollapsibleSection';

interface PresetPanelProps {
  factoryPresets: SavedPreset[];
  presets: SavedPreset[];
  selectedId: string | null;
  nameDraft: string;
  status: string | null;
  factorySelected: boolean;
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
  factoryPresets,
  presets,
  selectedId,
  nameDraft,
  status,
  factorySelected,
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
  const empty = factoryPresets.length === 0 && presets.length === 0;

  return (
    <CollapsibleSection
      mode="mobile"
      className="panel preset-panel"
      title="Presets"
      actions={
        <span className="panel-hint">
          {factoryPresets.length} factory · {presets.length} saved
        </span>
      }
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
          onChange={(e) => {
            setConfirmDelete(false);
            onSelect(e.target.value);
          }}
        >
          <option value="" disabled>
            {empty ? 'No presets yet' : 'Select preset…'}
          </option>
          {factoryPresets.length > 0 && (
            <optgroup label="Inspired by">
              {factoryPresets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          )}
          {presets.length > 0 && (
            <optgroup label="Yours">
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        {factorySelected && (
          <p className="hint">
            Factory patches are read-only. Save creates your own copy.
          </p>
        )}
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
          disabled={!selectedId || factorySelected}
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
