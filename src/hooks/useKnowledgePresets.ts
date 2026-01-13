import { useCallback, useEffect, useMemo, useState } from 'react';
import { localStorage as storage } from '../utils/storage';

export interface KnowledgePreset {
  id: string;
  name: string;
  description?: string;
  content: string;
  isCustom?: boolean;
}

interface StoredKnowledgePreset {
  id: string;
  name: string;
  description?: string;
  content: string;
}

const createPresetId = () => {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return `knowledge-${window.crypto.randomUUID()}`;
  }
  return `knowledge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
};

const toStoredPresets = (presets: KnowledgePreset[]): StoredKnowledgePreset[] =>
  presets.map(({ id, name, description, content }) => ({ id, name, description, content }));

const fromStoredPresets = (presets: StoredKnowledgePreset[]): KnowledgePreset[] =>
  presets.map((preset) => ({ ...preset, isCustom: true }));

export function useKnowledgePresets(basePresets: KnowledgePreset[] = []) {
  const [customPresets, setCustomPresets] = useState<KnowledgePreset[]>([]);
  const [overridePresets, setOverridePresets] = useState<KnowledgePreset[]>([]);
  const [removedPresetIds, setRemovedPresetIds] = useState<string[]>([]);

  useEffect(() => {
    const stored = storage.getKnowledgePresets();
    if (stored.length > 0) {
      setCustomPresets(fromStoredPresets(stored));
    }
    const overrides = storage.getKnowledgeOverrides();
    if (overrides.length > 0) {
      setOverridePresets(overrides);
    }
    const removed = storage.getKnowledgeRemovedPresetIds();
    if (removed.length > 0) {
      setRemovedPresetIds(removed);
    }
  }, []);

  const persistCustomPresets = useCallback((presets: KnowledgePreset[]) => {
    storage.saveKnowledgePresets(toStoredPresets(presets));
  }, []);

  const persistOverrides = useCallback((presets: KnowledgePreset[]) => {
    storage.saveKnowledgeOverrides(toStoredPresets(presets));
  }, []);

  const persistRemoved = useCallback((ids: string[]) => {
    storage.saveKnowledgeRemovedPresetIds(ids);
  }, []);

  const addPreset = useCallback((name: string, content: string, description?: string): KnowledgePreset => {
    const trimmedName = name.trim();
    const trimmedContent = content.trim();
    const trimmedDescription = description?.trim();

    if (!trimmedName || !trimmedContent) {
      throw new Error('プリセット名と内容は必須です');
    }

    const created: KnowledgePreset = {
      id: createPresetId(),
      name: trimmedName,
      description: trimmedDescription,
      content: trimmedContent,
      isCustom: true,
    };

    setCustomPresets((prev) => {
      const next = [...prev, created];
      persistCustomPresets(next);
      return next;
    });

    return created;
  }, [persistCustomPresets]);

  const updatePreset = useCallback((id: string, updates: { name?: string; description?: string; content?: string }): KnowledgePreset => {
    let updatedPreset: KnowledgePreset | null = null;

    setCustomPresets((prev) => {
      const index = prev.findIndex((preset) => preset.id === id);
      if (index === -1) {
        return prev;
      }
      const next = [...prev];
      const current = next[index];
      const updated: KnowledgePreset = {
        ...current,
        name: updates.name !== undefined ? updates.name.trim() : current.name,
        description: updates.description !== undefined ? updates.description.trim() : current.description,
        content: updates.content !== undefined ? updates.content.trim() : current.content,
        isCustom: true,
      };

      if (!updated.name || !updated.content) {
        throw new Error('プリセット名と内容は必須です');
      }

      next[index] = updated;
      updatedPreset = updated;
      persistCustomPresets(next);
      return next;
    });

    if (updatedPreset) {
      return updatedPreset;
    }

    // Update base preset via overrides
    setOverridePresets((prev) => {
      const next = [...prev];
      const index = next.findIndex((preset) => preset.id === id);
      const base = Array.isArray(basePresets) ? basePresets.find((preset) => preset.id === id) : undefined;
      const current = index !== -1 ? next[index] : base;
      if (!current) {
        return prev;
      }

      const updated: KnowledgePreset = {
        ...current,
        name: updates.name !== undefined ? updates.name.trim() : current.name,
        description: updates.description !== undefined ? updates.description.trim() : current.description,
        content: updates.content !== undefined ? updates.content.trim() : current.content,
        isCustom: current.isCustom,
      };

      if (!updated.name || !updated.content) {
        throw new Error('プリセット名と内容は必須です');
      }

      if (index === -1) {
        next.push(updated);
      } else {
        next[index] = updated;
      }
      updatedPreset = updated;
      persistOverrides(next);
      return next;
    });

    if (!updatedPreset) {
      throw new Error('指定したプリセットが見つかりませんでした');
    }

    return updatedPreset;
  }, [basePresets, persistCustomPresets, persistOverrides]);

  const removePreset = useCallback((id: string) => {
    setCustomPresets((prev) => {
      const next = prev.filter((preset) => preset.id !== id);
      if (next.length !== prev.length) {
        persistCustomPresets(next);
      }
      return next;
    });

    const base = Array.isArray(basePresets) ? basePresets.find((preset) => preset.id === id) : undefined;
    if (base) {
      setRemovedPresetIds((prev) => {
        if (prev.includes(id)) {
          return prev;
        }
        const next = [...prev, id];
        persistRemoved(next);
        return next;
      });
    }

    setOverridePresets((prev) => {
      const next = prev.filter((preset) => preset.id !== id);
      if (next.length !== prev.length) {
        persistOverrides(next);
      }
      return next;
    });
  }, [basePresets, persistCustomPresets, persistOverrides, persistRemoved]);

  const presets = useMemo(() => {
    const base = Array.isArray(basePresets)
      ? basePresets
          .filter((preset) => !removedPresetIds.includes(preset.id))
          .map((preset) => {
            const override = overridePresets.find((ov) => ov.id === preset.id);
            return {
              ...(override ?? preset),
              isCustom: Boolean(preset.isCustom),
            };
          })
      : [];

    const custom = customPresets.map((preset) => ({ ...preset, isCustom: true }));

    return [...base, ...custom];
  }, [basePresets, customPresets, overridePresets, removedPresetIds]);

  return {
    presets,
    addPreset,
    updatePreset,
    removePreset,
  };
}
