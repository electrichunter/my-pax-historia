/**
 * Preset management — localStorage-backed CRUD for reusable game configuration presets.
 *
 * A preset captures "Player Country + Game Date + Difficulty + Language + Simulation Rules
 * + Starting Timeline Text" so users can quickly apply a saved configuration when
 * creating or editing scenarios and games.
 */

const STORAGE_KEY = "pax-historia-presets";

const generateId = () =>
  `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

const readStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeStorage = (presets) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
};

/**
 * Load all saved presets.
 * @returns {Array<Object>}
 */
export const loadPresets = () => readStorage();

/**
 * Save a new preset. Returns the full list after saving.
 * @param {Object} preset
 * @returns {Array<Object>}
 */
export const savePreset = (preset) => {
  const presets = readStorage();
  const entry = {
    ...preset,
    id: preset.id || generateId(),
    createdAt: preset.createdAt || new Date().toISOString(),
  };
  presets.push(entry);
  writeStorage(presets);
  return presets;
};

/**
 * Update an existing preset by id. Returns the full list after updating.
 * @param {string} presetId
 * @param {Object} updates
 * @returns {Array<Object>}
 */
export const updatePreset = (presetId, updates) => {
  const presets = readStorage();
  const index = presets.findIndex((p) => p.id === presetId);
  if (index >= 0) {
    presets[index] = {
      ...presets[index],
      ...updates,
      id: presetId,
      updatedAt: new Date().toISOString(),
    };
  }
  writeStorage(presets);
  return presets;
};

/**
 * Delete a preset by id. Returns the full list after deleting.
 * @param {string} presetId
 * @returns {Array<Object>}
 */
export const deletePreset = (presetId) => {
  const presets = readStorage().filter((p) => p.id !== presetId);
  writeStorage(presets);
  return presets;
};

/**
 * Export all presets as a downloadable JSON file.
 */
export const exportPresets = () => {
  const presets = readStorage();
  const blob = new Blob([JSON.stringify(presets, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `pax-historia-presets-${Date.now()}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

/**
 * Import presets from a JSON file (File or Blob). Merges with existing presets
 * (skips duplicates by id). Returns the full list after import.
 * @param {File|Blob} file
 * @returns {Promise<Array<Object>>}
 */
export const importPresets = async (file) => {
  const text = await file.text();
  const incoming = JSON.parse(text);

  if (!Array.isArray(incoming)) {
    throw new Error("Invalid preset file: expected a JSON array.");
  }

  const existing = readStorage();
  const existingIds = new Set(existing.map((p) => p.id));

  for (const preset of incoming) {
    if (!preset || typeof preset !== "object") continue;

    const entry = {
      ...preset,
      id: preset.id || generateId(),
      createdAt: preset.createdAt || new Date().toISOString(),
    };

    if (!existingIds.has(entry.id)) {
      existing.push(entry);
      existingIds.add(entry.id);
    }
  }

  writeStorage(existing);
  return existing;
};

/**
 * Build a preset object from the current editor form state.
 * @param {string} name
 * @param {Object} formState
 * @returns {Object}
 */
export const buildPresetFromFormState = (name, formState) => ({
  id: generateId(),
  name: String(name || "").trim() || "Untitled Preset",
  country: formState.country || "",
  gameDate: formState.gameDate || "",
  difficulty: formState.difficulty || "standard",
  language: formState.language || "English",
  simulationRules: formState.simulationRules || "",
  startingTimelineText: formState.startingTimelineText || "",
  createdAt: new Date().toISOString(),
});

/**
 * Apply a preset's values onto the current form state, returning a merged copy.
 * Only overwrites fields that the preset defines (non-empty).
 * @param {Object} currentFormState
 * @param {Object} preset
 * @returns {Object}
 */
export const applyPresetToFormState = (currentFormState, preset) => ({
  ...currentFormState,
  ...(preset.country ? { country: preset.country } : {}),
  ...(preset.gameDate ? { gameDate: preset.gameDate } : {}),
  ...(preset.difficulty ? { difficulty: preset.difficulty } : {}),
  ...(preset.language ? { language: preset.language } : {}),
  ...(preset.simulationRules !== undefined
    ? { simulationRules: preset.simulationRules }
    : {}),
  ...(preset.startingTimelineText !== undefined
    ? { startingTimelineText: preset.startingTimelineText }
    : {}),
});
