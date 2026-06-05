import React, { useRef, useState } from "react";
import {
  applyPresetToFormState,
  buildPresetFromFormState,
  deletePreset,
  exportPresets,
  importPresets,
  loadPresets,
  savePreset,
} from "../../runtime/presets.js";

const actionButtonStyle = {
  alignItems: "center",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "999px",
  color: "rgba(244,246,255,0.92)",
  cursor: "pointer",
  display: "inline-flex",
  fontSize: "0.82rem",
  fontWeight: 600,
  gap: "0.4rem",
  justifyContent: "center",
  minHeight: "2.1rem",
  padding: "0 0.95rem",
  transition: "background 0.18s ease, border-color 0.18s ease, transform 0.18s ease",
};

const inputStyle = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "12px",
  color: "#f8fafc",
  fontSize: "0.9rem",
  outline: "none",
  padding: "0.8rem 0.9rem",
  width: "100%",
};

const cardStyle = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.025))",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "16px",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
  overflow: "hidden",
  padding: "0.85rem 0.95rem",
};

const tagStyle = {
  background: "rgba(255,255,255,0.07)",
  borderRadius: "8px",
  color: "rgba(210,218,235,0.72)",
  display: "inline-flex",
  fontSize: "0.7rem",
  fontWeight: 500,
  padding: "0.22rem 0.48rem",
};

const emptyStateStyle = {
  alignItems: "center",
  background: "rgba(255,255,255,0.03)",
  border: "1px dashed rgba(255,255,255,0.1)",
  borderRadius: "16px",
  color: "rgba(214,226,255,0.48)",
  display: "flex",
  flexDirection: "column",
  fontSize: "0.82rem",
  fontStyle: "italic",
  gap: "0.5rem",
  justifyContent: "center",
  lineHeight: "1.55",
  minHeight: "8rem",
  padding: "1.2rem",
  textAlign: "center",
};

const formatDate = (isoString) => {
  if (!isoString) return "";
  try {
    return new Date(isoString).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
};

const PresetCard = ({ preset, onApply, onDelete }) => {
  const [hovered, setHovered] = useState(false);

  const details = [
    preset.country && `🌍 ${preset.country}`,
    preset.gameDate && `📅 ${preset.gameDate}`,
    preset.difficulty && preset.difficulty !== "standard" && `⚔️ ${preset.difficulty}`,
    preset.language && preset.language !== "English" && `🗣️ ${preset.language}`,
  ].filter(Boolean);

  return (
    <div
      style={{
        ...cardStyle,
        borderColor: hovered ? "rgba(124,58,237,0.35)" : "rgba(255,255,255,0.08)",
        transition: "border-color 0.2s ease",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          alignItems: "flex-start",
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "0.5rem",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              color: "rgba(255,255,255,0.95)",
              fontSize: "0.9rem",
              fontWeight: 700,
              letterSpacing: "-0.01em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {preset.name}
          </div>
          {preset.createdAt && (
            <div
              style={{
                color: "rgba(180,190,210,0.45)",
                fontSize: "0.68rem",
                marginTop: "0.15rem",
              }}
            >
              {formatDate(preset.createdAt)}
            </div>
          )}
        </div>
      </div>

      {details.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.35rem",
            marginBottom: "0.6rem",
          }}
        >
          {details.map((detail) => (
            <span key={detail} style={tagStyle}>
              {detail}
            </span>
          ))}
        </div>
      )}

      {(preset.simulationRules || preset.startingTimelineText) && (
        <div
          style={{
            color: "rgba(200,210,230,0.45)",
            fontSize: "0.7rem",
            fontStyle: "italic",
            marginBottom: "0.55rem",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {preset.simulationRules
            ? `Rules: ${preset.simulationRules.slice(0, 60)}…`
            : `Timeline: ${preset.startingTimelineText.slice(0, 60)}…`}
        </div>
      )}

      <div style={{ display: "flex", gap: "0.45rem" }}>
        <button
          type="button"
          onClick={() => onApply(preset)}
          style={{
            ...actionButtonStyle,
            background: "rgba(124,58,237,0.22)",
            borderColor: "rgba(124,58,237,0.36)",
            flex: 1,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(124,58,237,0.35)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(124,58,237,0.22)";
          }}
        >
          Apply
        </button>
        <button
          type="button"
          onClick={() => onDelete(preset.id)}
          style={{
            ...actionButtonStyle,
            background: "rgba(127,29,29,0.2)",
            borderColor: "rgba(248,113,113,0.18)",
            color: "rgba(254,202,202,0.85)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(127,29,29,0.35)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(127,29,29,0.2)";
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
};

/**
 * Preset management panel — create, apply, delete, import/export presets.
 *
 * Designed to sit inside the EditorDrawer as a new tab, matching the existing
 * glassmorphism design language of the library bar.
 *
 * @param {Object} props
 * @param {Object} props.formState       Current editor form state
 * @param {Function} props.onFormChange  Called to update the parent form state. Receives a full merged formState.
 */
const PresetManager = ({ formState, onFormChange }) => {
  const [presets, setPresets] = useState(() => loadPresets());
  const [isCreating, setIsCreating] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [statusMessage, setStatusMessage] = useState(null);
  const importInputRef = useRef(null);

  const showStatus = (message, duration = 2500) => {
    setStatusMessage(message);
    setTimeout(() => setStatusMessage(null), duration);
  };

  const handleCreate = () => {
    if (!newPresetName.trim()) return;

    const preset = buildPresetFromFormState(newPresetName.trim(), formState);
    const updated = savePreset(preset);
    setPresets(updated);
    setIsCreating(false);
    setNewPresetName("");
    showStatus(`Preset "${preset.name}" saved`);
  };

  const handleApply = (preset) => {
    const merged = applyPresetToFormState(formState, preset);
    onFormChange(merged);
    showStatus(`Preset "${preset.name}" applied`);
  };

  const handleDelete = (presetId) => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;

    if (!window.confirm(`Delete preset "${preset.name}"?`)) return;

    const updated = deletePreset(presetId);
    setPresets(updated);
    showStatus(`Preset deleted`);
  };

  const handleExport = () => {
    exportPresets();
    showStatus("Presets exported");
  };

  const handleImportFile = async (event) => {
    const [file] = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!file) return;

    try {
      const updated = await importPresets(file);
      setPresets(updated);
      showStatus(`${updated.length} preset(s) loaded`);
    } catch (error) {
      showStatus(`Import failed: ${error.message}`);
    }
  };

  const handleCreateKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleCreate();
    } else if (event.key === "Escape") {
      setIsCreating(false);
      setNewPresetName("");
    }
  };

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "18px",
        padding: "0.9rem",
      }}
    >
      {/* Header actions */}
      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.45rem",
          marginBottom: "0.85rem",
        }}
      >
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          style={{
            ...actionButtonStyle,
            background: "rgba(124,58,237,0.22)",
            borderColor: "rgba(124,58,237,0.36)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(124,58,237,0.35)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(124,58,237,0.22)";
          }}
        >
          + New Preset
        </button>
        <button
          type="button"
          onClick={() => importInputRef.current?.click()}
          style={actionButtonStyle}
        >
          Import
        </button>
        {presets.length > 0 && (
          <button type="button" onClick={handleExport} style={actionButtonStyle}>
            Export All
          </button>
        )}
        <input
          ref={importInputRef}
          accept=".json,application/json"
          onChange={handleImportFile}
          style={{ display: "none" }}
          type="file"
        />
      </div>

      {/* Create form */}
      {isCreating && (
        <div
          style={{
            ...cardStyle,
            borderColor: "rgba(124,58,237,0.3)",
            marginBottom: "0.75rem",
          }}
        >
          <div
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: "0.72rem",
              fontWeight: 600,
              letterSpacing: "0.06em",
              marginBottom: "0.45rem",
              textTransform: "uppercase",
            }}
          >
            Create Preset from Current Settings
          </div>
          <div
            style={{
              color: "rgba(200,210,230,0.5)",
              fontSize: "0.74rem",
              lineHeight: 1.45,
              marginBottom: "0.65rem",
            }}
          >
            Saves the current Player Country, Game Date, Difficulty, Language, Simulation
            Rules, and Starting Timeline.
          </div>
          <input
            style={{ ...inputStyle, marginBottom: "0.55rem" }}
            placeholder="Preset name (e.g. Ottoman Empire 1453)"
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
            onKeyDown={handleCreateKeyDown}
            autoFocus
          />
          <div style={{ display: "flex", gap: "0.45rem" }}>
            <button
              type="button"
              onClick={handleCreate}
              style={{
                ...actionButtonStyle,
                background: "rgba(124,58,237,0.28)",
                borderColor: "rgba(124,58,237,0.42)",
              }}
            >
              Save Preset
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setNewPresetName("");
              }}
              style={actionButtonStyle}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Status message */}
      {statusMessage && (
        <div
          style={{
            background: "rgba(124,58,237,0.12)",
            border: "1px solid rgba(124,58,237,0.28)",
            borderRadius: "12px",
            color: "rgba(233,213,255,0.9)",
            fontSize: "0.78rem",
            marginBottom: "0.7rem",
            padding: "0.55rem 0.75rem",
            textAlign: "center",
          }}
        >
          {statusMessage}
        </div>
      )}

      {/* Preset list */}
      {presets.length === 0 ? (
        <div style={emptyStateStyle}>
          <div style={{ fontSize: "1.5rem" }}>📋</div>
          <div>
            No presets yet. Click <strong>&ldquo;+ New Preset&rdquo;</strong> to save your
            current settings as a reusable template.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
          {presets.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              onApply={handleApply}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default PresetManager;
