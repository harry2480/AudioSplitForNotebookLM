import { useMemo, useState } from 'react';
import { Layers, PlusCircle, Trash2, Pencil, CheckSquare, Square, Info, ChevronDown, ChevronRight } from 'lucide-react';
import type { KnowledgePreset } from '../hooks/useKnowledgePresets';

interface KnowledgePresetSelectorProps {
  presets: KnowledgePreset[];
  disabled?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  onInsert: (selectedPresets: KnowledgePreset[]) => void;
  addPreset: (name: string, content: string, description?: string) => KnowledgePreset;
  updatePreset: (id: string, updates: { name?: string; description?: string; content?: string }) => KnowledgePreset;
  removePreset: (id: string) => void;
}

export function KnowledgePresetSelector({
  presets,
  disabled = false,
  selectedIds,
  onSelectionChange,
  onInsert,
  addPreset,
  updatePreset,
  removePreset,
}: KnowledgePresetSelectorProps) {
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isControlled = selectedIds !== undefined;
  const currentSelectedIds = isControlled ? (selectedIds as string[]) : internalSelectedIds;
  const selectedCount = currentSelectedIds.length;

  const updateSelection = (updater: (prev: string[]) => string[]) => {
    const next = updater(currentSelectedIds);
    onSelectionChange?.(next);
    if (!isControlled) {
      setInternalSelectedIds(next);
    }
  };

  const selectablePresets = useMemo(() => presets ?? [], [presets]);

  const toggleSelection = (id: string) => {
    updateSelection((prev) => {
      if (prev.includes(id)) {
        return prev.filter((presetId) => presetId !== id);
      }
      return [...prev, id];
    });
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormContent('');
    setFormError(null);
    setEditingId(null);
  };

  const handleFormSubmit = () => {
    try {
      if (editingId) {
        updatePreset(editingId, {
          name: formName,
          description: formDescription,
          content: formContent,
        });
      } else {
        addPreset(formName, formContent, formDescription);
      }
      resetForm();
      setShowForm(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'プリセットの保存に失敗しました';
      setFormError(message);
    }
  };

  const handleEditPreset = (preset: KnowledgePreset) => {
    setShowForm(true);
    setEditingId(preset.id);
    setFormName(preset.name);
    setFormDescription(preset.description ?? '');
    setFormContent(preset.content);
    setFormError(null);
  };

  const handleDeletePreset = (id: string) => {
    removePreset(id);
    updateSelection((prev) => prev.filter((presetId) => presetId !== id));
    if (editingId === id) {
      resetForm();
      setShowForm(false);
    }
  };

  const handleApply = () => {
    if (currentSelectedIds.length === 0) return;
    const targets = selectablePresets.filter((preset) => currentSelectedIds.includes(preset.id));
    if (targets.length === 0) return;
    onInsert(targets);
  };

  const handleClearSelection = () => updateSelection(() => []);

  return (
    <div className="bg-white border border-blue-200 rounded-lg p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-blue-800">
          <Layers className="w-4 h-4" />
          <div>
            <p className="text-sm font-semibold">知識プリセット</p>
            <p className="text-xs text-blue-600">会議の文脈や目的をワンクリックで挿入</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (showForm && editingId) {
              resetForm();
            }
            setShowForm((prev) => !prev);
          }}
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900"
        >
          <PlusCircle className="w-4 h-4" />
          {showForm ? 'フォームを閉じる' : 'プリセットを作成'}
        </button>
      </div>

      {showForm && (
        <div className="space-y-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div>
            <label className="text-xs text-blue-800 block mb-1">プリセット名</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full px-3 py-2 border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="例: 商談（大手顧客）"
            />
          </div>
          <div>
            <label className="text-xs text-blue-800 block mb-1">概要（任意）</label>
            <input
              type="text"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full px-3 py-2 border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="例: 価格交渉や意思決定者の情報など"
            />
          </div>
          <div>
            <label className="text-xs text-blue-800 block mb-1">挿入する背景テキスト</label>
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              className="w-full px-3 py-2 border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs resize-y min-h-24 font-mono"
              placeholder="目的、参加者、想定トピック、優先課題などを記載"
            />
          </div>
          {formError && <p className="text-xs text-red-600">{formError}</p>}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleFormSubmit}
              disabled={!formName.trim() || !formContent.trim()}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700 disabled:opacity-40"
            >
              {editingId ? '更新' : '保存'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-3 py-1.5 text-xs text-blue-700 hover:text-blue-900"
            >
              クリア
            </button>
          </div>
        </div>
      )}

      <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
        {selectablePresets.map((preset) => {
          const isSelected = currentSelectedIds.includes(preset.id);
          const isExpanded = expandedId === preset.id;
          return (
            <div
              key={preset.id}
              className={`rounded-lg border ${isExpanded ? 'border-blue-400 bg-blue-50' : 'border-blue-100 bg-white'}`}
            >
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleSelection(preset.id)}
                    className={`text-blue-600 ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                    aria-label={`${preset.name}を${isSelected ? '解除' : '選択'}`}
                    disabled={disabled}
                  >
                    {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedId((prev) => (prev === preset.id ? null : preset.id))}
                    className="flex items-center gap-2 text-left"
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-blue-600" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    <span className="text-sm font-semibold text-gray-800">{preset.name}</span>
                  </button>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleEditPreset(preset)}
                    className="p-1 text-gray-500 hover:text-blue-700"
                    aria-label={`${preset.name}を編集`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePreset(preset.id)}
                    className="p-1 text-gray-500 hover:text-red-600"
                    aria-label={`${preset.name}を削除`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {isExpanded && (
                <div className="px-3 pb-3 text-[11px] text-gray-700 space-y-1">
                  {preset.description && <p className="text-gray-600">{preset.description}</p>}
                  <p className="whitespace-pre-wrap border border-gray-100 rounded-md p-2 bg-gray-50">
                    {preset.content}
                  </p>
                </div>
              )}
            </div>
          );
        })}
        {selectablePresets.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-4">プリセットがまだありません。作成してみましょう。</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-1 text-xs text-blue-700">
          <Info className="w-3 h-3" />
          <span>{selectedCount > 0 ? `${selectedCount}件選択中` : '複数選択してまとめて挿入できます'}</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleClearSelection}
            disabled={currentSelectedIds.length === 0}
            className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 disabled:opacity-40"
          >
            クリア
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={disabled || currentSelectedIds.length === 0}
            className="px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-full hover:bg-blue-700 disabled:opacity-40"
          >
            選択内容を背景情報に追加
          </button>
        </div>
      </div>
    </div>
  );
}
