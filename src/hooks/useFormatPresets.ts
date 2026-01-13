import { useCallback, useEffect, useMemo, useState } from 'react';
import { localStorage as storage } from '../utils/storage';

export interface FormatPreset {
  id: string;
  name: string;
  prompt: string;
  isCustom?: boolean;
  isRemovable?: boolean;
}

interface StoredPreset {
  id: string;
  name: string;
  prompt: string;
}

const createPresetId = () => {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return `custom-${window.crypto.randomUUID()}`;
  }
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
};

const toStoredPresets = (presets: FormatPreset[]): StoredPreset[] =>
  presets.map(({ id, name, prompt }) => ({ id, name, prompt }));

const fromStoredPresets = (presets: StoredPreset[]): FormatPreset[] =>
  presets.map((preset) => ({ ...preset, isCustom: true, isRemovable: true }));

export function useFormatPresets(basePresets: FormatPreset[] = []) {
  const [customPresets, setCustomPresets] = useState<FormatPreset[]>([]);
  const [removedPresetIds, setRemovedPresetIds] = useState<string[]>([]);

  useEffect(() => {
    const stored = storage.getSummaryPromptPresets();
    if (stored.length > 0) {
      setCustomPresets(fromStoredPresets(stored));
    }
    const removed = storage.getSummaryRemovedPresetIds();
    if (removed.length > 0) {
      setRemovedPresetIds(removed);
    }
  }, []);

  const persistCustomPresets = useCallback((presets: FormatPreset[]) => {
    storage.saveSummaryPromptPresets(toStoredPresets(presets));
  }, []);

  const persistRemovedPresetIds = useCallback((ids: string[]) => {
    storage.saveSummaryRemovedPresetIds(ids);
  }, []);

  const addCustomPreset = useCallback((name: string, prompt: string): FormatPreset => {
    const trimmedName = name.trim();
    const trimmedPrompt = prompt.trim();
    if (!trimmedName || !trimmedPrompt) {
      throw new Error('プリセット名とプロンプトを入力してください');
    }
    const created: FormatPreset = { id: createPresetId(), name: trimmedName, prompt: trimmedPrompt, isCustom: true, isRemovable: true };
    setCustomPresets((prev) => {
      const next = [...prev, created];
      persistCustomPresets(next);
      return next;
    });
    return created;
  }, [persistCustomPresets]);

  const removeCustomPreset = useCallback((id: string) => {
    setCustomPresets((prev) => {
      const next = prev.filter((preset) => preset.id !== id);
      persistCustomPresets(next);
      return next;
    });
  }, [persistCustomPresets]);

  const updateCustomPreset = useCallback((id: string, updates: { name?: string; prompt?: string }): FormatPreset => {
    let updatedPreset: FormatPreset | null = null;

    const applyUpdate = (list: FormatPreset[], index: number) => {
      const next = [...list];
      const current = next[index];
      const updated: FormatPreset = {
        ...current,
        name: updates.name !== undefined ? updates.name.trim() : current.name,
        prompt: updates.prompt !== undefined ? updates.prompt.trim() : current.prompt,
        isCustom: true,
        isRemovable: true,
      };
      if (!updated.name || !updated.prompt) {
        throw new Error('プリセット名とプロンプトは必須です');
      }
      next[index] = updated;
      updatedPreset = updated;
      persistCustomPresets(next);
      return next;
    };

    setCustomPresets((prev) => {
      const index = prev.findIndex((preset) => preset.id === id);
      if (index !== -1) {
        return applyUpdate(prev, index);
      }

      const storedPresets = fromStoredPresets(storage.getSummaryPromptPresets());
      const storedIndex = storedPresets.findIndex((preset) => preset.id === id);
      if (storedIndex === -1) {
        updatedPreset = null;
        return prev;
      }

      return applyUpdate(storedPresets, storedIndex);
    });

    if (!updatedPreset) {
      throw new Error('指定したプリセットが見つかりませんでした');
    }

    return updatedPreset;
  }, [persistCustomPresets]);

  const removePreset = useCallback((id: string) => {
    const customTarget = customPresets.find((preset) => preset.id === id);
    if (customTarget) {
      removeCustomPreset(id);
      return;
    }

    const targetBasePreset = Array.isArray(basePresets) ? basePresets.find((preset) => preset.id === id) : undefined;
    if (!targetBasePreset || targetBasePreset.isRemovable === false) {
      return;
    }

    setRemovedPresetIds((prev) => {
      if (prev.includes(id)) {
        return prev;
      }
      const next = [...prev, id];
      persistRemovedPresetIds(next);
      return next;
    });
  }, [basePresets, customPresets, persistRemovedPresetIds, removeCustomPreset]);

  const presets = useMemo(() => {
    const base = Array.isArray(basePresets)
      ? basePresets
          .map((preset) => ({
            ...preset,
            isCustom: Boolean(preset.isCustom),
            isRemovable: preset.isRemovable ?? false,
          }))
          .filter((preset) => !removedPresetIds.includes(preset.id))
      : [];

    const custom = customPresets.map((preset) => ({
      ...preset,
      isCustom: true,
      isRemovable: true,
    }));

    return [...base, ...custom];
  }, [basePresets, customPresets, removedPresetIds]);

  return {
    presets,
    customPresets,
    addCustomPreset,
    removeCustomPreset,
    updateCustomPreset,
    removePreset,
  };
}
