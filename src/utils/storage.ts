// セキュアなストレージユーティリティ

export interface DestinationFieldMapping {
  companyName?: string;
  meetingDate?: string;
  summary?: string;
  title?: string;
  createdAt?: string;
  token?: string;
}

export interface SheetDestinationConfig {
  id: string;
  name: string;
  url: string;
  token?: string;
  fieldMapping?: DestinationFieldMapping;
}

const STORAGE_KEYS = {
  CUSTOM_PROMPT: 'audioSplit_customPrompt',
  SUMMARY_CUSTOM_PROMPT: 'audioSplit_summaryCustomPrompt',
  SUMMARY_BACKGROUND_INFO: 'audioSplit_summaryBackgroundInfo',
  SUMMARY_COMPANY_NAME: 'audioSplit_summaryCompanyName',
  SUMMARY_MEETING_DATE: 'audioSplit_summaryMeetingDate',
  SHEET_DESTINATIONS: 'audioSplit_sheetDestinations',
  SUMMARY_PROMPT_PRESETS: 'audioSplit_summaryPromptPresets',
  SUMMARY_REMOVED_PRESETS: 'audioSplit_summaryRemovedPresets',
  KNOWLEDGE_PRESETS: 'audioSplit_knowledgePresets',
  KNOWLEDGE_OVERRIDES: 'audioSplit_knowledgeOverrides',
  KNOWLEDGE_REMOVED: 'audioSplit_knowledgeRemoved',
  API_KEY_HASH: 'audioSplit_apiKeyHash',
  API_ENDPOINT: 'audioSplit_apiEndpoint',
  SETTINGS: 'audioSplit_settings'
} as const;

// APIキーのハッシュ化（簡易的な難読化）
function obfuscateApiKey(apiKey: string): string {
  if (!apiKey) return '';
  
  // Base64エンコードして文字を逆順にする（簡易難読化）
  const encoded = btoa(apiKey);
  return encoded.split('').reverse().join('');
}

function deobfuscateApiKey(obfuscated: string): string {
  if (!obfuscated) return '';
  
  try {
    // 逆順を元に戻してBase64デコード
    const reversed = obfuscated.split('').reverse().join('');
    return atob(reversed);
  } catch {
    return '';
  }
}

// APIキー保存方式の設定
type ApiKeyStorageMode = 'session' | 'persistent' | 'none';

const API_STORAGE_MODE_KEY = 'audioSplit_apiStorageMode';
const API_KEY_PERSISTENT = 'audioSplit_apiKeyPersistent';

// ストレージモード管理
export const storageMode = {
  getMode: (): ApiKeyStorageMode => {
    return (window.localStorage.getItem(API_STORAGE_MODE_KEY) as ApiKeyStorageMode) || 'session';
  },
  
  setMode: (mode: ApiKeyStorageMode): void => {
    window.localStorage.setItem(API_STORAGE_MODE_KEY, mode);
    
    // モード変更時に既存のAPIキーをクリア
    window.sessionStorage.removeItem(STORAGE_KEYS.API_KEY_HASH);
    window.localStorage.removeItem(API_KEY_PERSISTENT);
  }
};

// APIキーストレージ（モード対応）
export const apiKeyStorage = {
  save: (apiKey: string): void => {
    const mode = storageMode.getMode();
    
    if (!apiKey) {
      window.sessionStorage.removeItem(STORAGE_KEYS.API_KEY_HASH);
      window.localStorage.removeItem(API_KEY_PERSISTENT);
      return;
    }
    
    const obfuscated = obfuscateApiKey(apiKey);
    
    switch (mode) {
      case 'session':
        window.sessionStorage.setItem(STORAGE_KEYS.API_KEY_HASH, obfuscated);
        window.localStorage.removeItem(API_KEY_PERSISTENT);
        break;
      case 'persistent':
        window.localStorage.setItem(API_KEY_PERSISTENT, obfuscated);
        window.sessionStorage.removeItem(STORAGE_KEYS.API_KEY_HASH);
        break;
      case 'none':
        // 保存しない
        break;
    }
  },
  
  get: (): string => {
    const mode = storageMode.getMode();
    let obfuscated = '';
    
    switch (mode) {
      case 'session':
        obfuscated = window.sessionStorage.getItem(STORAGE_KEYS.API_KEY_HASH) || '';
        break;
      case 'persistent':
        obfuscated = window.localStorage.getItem(API_KEY_PERSISTENT) || '';
        break;
      case 'none':
        return '';
    }
    
    return obfuscated ? deobfuscateApiKey(obfuscated) : '';
  },
  
  clear: (): void => {
    window.sessionStorage.removeItem(STORAGE_KEYS.API_KEY_HASH);
    window.localStorage.removeItem(API_KEY_PERSISTENT);
  }
};

// APIエンドポイントストレージ
export const apiEndpointStorage = {
  save: (endpoint: string): void => {
    if (!endpoint || endpoint === 'https://generativelanguage.googleapis.com') {
      window.localStorage.removeItem(STORAGE_KEYS.API_ENDPOINT);
      return;
    }
    window.localStorage.setItem(STORAGE_KEYS.API_ENDPOINT, endpoint);
  },
  
  get: (): string => {
    return window.localStorage.getItem(STORAGE_KEYS.API_ENDPOINT) || 'https://generativelanguage.googleapis.com';
  },
  
  clear: (): void => {
    window.localStorage.removeItem(STORAGE_KEYS.API_ENDPOINT);
  }
};

// ローカルストレージ（永続保存）
export const localStorage = {
  // カスタムプロンプトは永続保存
  saveCustomPrompt: (prompt: string): void => {
    if (!prompt) {
      window.localStorage.removeItem(STORAGE_KEYS.CUSTOM_PROMPT);
      return;
    }
    window.localStorage.setItem(STORAGE_KEYS.CUSTOM_PROMPT, prompt);
  },
  
  getCustomPrompt: (): string => {
    return window.localStorage.getItem(STORAGE_KEYS.CUSTOM_PROMPT) || '';
  },
  
  clearCustomPrompt: (): void => {
    window.localStorage.removeItem(STORAGE_KEYS.CUSTOM_PROMPT);
  },
  
  // まとめ用カスタムプロンプト
  saveSummaryCustomPrompt: (prompt: string): void => {
    if (!prompt) {
      window.localStorage.removeItem(STORAGE_KEYS.SUMMARY_CUSTOM_PROMPT);
      return;
    }
    window.localStorage.setItem(STORAGE_KEYS.SUMMARY_CUSTOM_PROMPT, prompt);
  },
  
  getSummaryCustomPrompt: (): string => {
    return window.localStorage.getItem(STORAGE_KEYS.SUMMARY_CUSTOM_PROMPT) || '';
  },
  
  clearSummaryCustomPrompt: (): void => {
    window.localStorage.removeItem(STORAGE_KEYS.SUMMARY_CUSTOM_PROMPT);
  },
  
  // まとめ用背景情報
  saveSummaryBackgroundInfo: (backgroundInfo: string): void => {
    if (!backgroundInfo) {
      window.localStorage.removeItem(STORAGE_KEYS.SUMMARY_BACKGROUND_INFO);
      return;
    }
    window.localStorage.setItem(STORAGE_KEYS.SUMMARY_BACKGROUND_INFO, backgroundInfo);
  },
  
  getSummaryBackgroundInfo: (): string => {
    return window.localStorage.getItem(STORAGE_KEYS.SUMMARY_BACKGROUND_INFO) || '';
  },
  
  clearSummaryBackgroundInfo: (): void => {
    window.localStorage.removeItem(STORAGE_KEYS.SUMMARY_BACKGROUND_INFO);
  },

  // まとめ用プリセット
  saveSummaryPromptPresets: (presets: Array<{ id: string; name: string; prompt: string }>): void => {
    if (!presets || presets.length === 0) {
      window.localStorage.removeItem(STORAGE_KEYS.SUMMARY_PROMPT_PRESETS);
      return;
    }
    window.localStorage.setItem(STORAGE_KEYS.SUMMARY_PROMPT_PRESETS, JSON.stringify(presets));
  },

  getSummaryPromptPresets: (): Array<{ id: string; name: string; prompt: string }> => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEYS.SUMMARY_PROMPT_PRESETS);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((preset) =>
        preset && typeof preset.id === 'string' && typeof preset.name === 'string' && typeof preset.prompt === 'string'
      );
    } catch {
      return [];
    }
  },

  clearSummaryPromptPresets: (): void => {
    window.localStorage.removeItem(STORAGE_KEYS.SUMMARY_PROMPT_PRESETS);
  },

  saveKnowledgePresets: (presets: Array<{ id: string; name: string; description?: string; content: string }>): void => {
    if (!presets || presets.length === 0) {
      window.localStorage.removeItem(STORAGE_KEYS.KNOWLEDGE_PRESETS);
      return;
    }
    window.localStorage.setItem(STORAGE_KEYS.KNOWLEDGE_PRESETS, JSON.stringify(presets));
  },

  getKnowledgePresets: (): Array<{ id: string; name: string; description?: string; content: string }> => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEYS.KNOWLEDGE_PRESETS);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((preset) =>
        preset && typeof preset.id === 'string' && typeof preset.name === 'string' && typeof preset.content === 'string'
      ).map((preset) => ({
        id: preset.id,
        name: preset.name,
        content: preset.content,
        description: typeof preset.description === 'string' ? preset.description : undefined,
      }));
    } catch {
      return [];
    }
  },

  clearKnowledgePresets: (): void => {
    window.localStorage.removeItem(STORAGE_KEYS.KNOWLEDGE_PRESETS);
  },

  saveKnowledgeOverrides: (presets: Array<{ id: string; name: string; description?: string; content: string }>): void => {
    if (!presets || presets.length === 0) {
      window.localStorage.removeItem(STORAGE_KEYS.KNOWLEDGE_OVERRIDES);
      return;
    }
    window.localStorage.setItem(STORAGE_KEYS.KNOWLEDGE_OVERRIDES, JSON.stringify(presets));
  },

  getKnowledgeOverrides: (): Array<{ id: string; name: string; description?: string; content: string }> => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEYS.KNOWLEDGE_OVERRIDES);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((preset) =>
        preset && typeof preset.id === 'string' && typeof preset.name === 'string' && typeof preset.content === 'string'
      ).map((preset) => ({
        id: preset.id,
        name: preset.name,
        content: preset.content,
        description: typeof preset.description === 'string' ? preset.description : undefined,
      }));
    } catch {
      return [];
    }
  },

  clearKnowledgeOverrides: (): void => {
    window.localStorage.removeItem(STORAGE_KEYS.KNOWLEDGE_OVERRIDES);
  },

  saveKnowledgeRemovedPresetIds: (ids: string[]): void => {
    const filtered = Array.isArray(ids)
      ? ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      : [];

    if (filtered.length === 0) {
      window.localStorage.removeItem(STORAGE_KEYS.KNOWLEDGE_REMOVED);
      return;
    }

    window.localStorage.setItem(STORAGE_KEYS.KNOWLEDGE_REMOVED, JSON.stringify(filtered));
  },

  getKnowledgeRemovedPresetIds: (): string[] => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEYS.KNOWLEDGE_REMOVED);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
    } catch {
      return [];
    }
  },

  clearKnowledgeRemovedPresetIds: (): void => {
    window.localStorage.removeItem(STORAGE_KEYS.KNOWLEDGE_REMOVED);
  },

  saveSummaryRemovedPresetIds: (ids: string[]): void => {
    const filtered = Array.isArray(ids)
      ? ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      : [];

    if (filtered.length === 0) {
      window.localStorage.removeItem(STORAGE_KEYS.SUMMARY_REMOVED_PRESETS);
      return;
    }

    window.localStorage.setItem(STORAGE_KEYS.SUMMARY_REMOVED_PRESETS, JSON.stringify(filtered));
  },

  getSummaryRemovedPresetIds: (): string[] => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEYS.SUMMARY_REMOVED_PRESETS);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
    } catch {
      return [];
    }
  },

  clearSummaryRemovedPresetIds: (): void => {
    window.localStorage.removeItem(STORAGE_KEYS.SUMMARY_REMOVED_PRESETS);
  },

  saveSheetDestinations: (destinations: SheetDestinationConfig[]): void => {
    window.localStorage.setItem(STORAGE_KEYS.SHEET_DESTINATIONS, JSON.stringify(destinations));
  },

  getSheetDestinations: (): SheetDestinationConfig[] => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.SHEET_DESTINATIONS);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((dest) => dest && typeof dest.id === 'string' && typeof dest.name === 'string' && typeof dest.url === 'string')
        .map((dest) => ({
          ...dest,
          fieldMapping: dest.fieldMapping || undefined,
        }));
    } catch {
      return [];
    }
  },

  saveSummaryCompanyName: (name: string): void => {
    if (!name.trim()) {
      window.localStorage.removeItem(STORAGE_KEYS.SUMMARY_COMPANY_NAME);
      return;
    }
    window.localStorage.setItem(STORAGE_KEYS.SUMMARY_COMPANY_NAME, name.trim());
  },

  getSummaryCompanyName: (): string => {
    return window.localStorage.getItem(STORAGE_KEYS.SUMMARY_COMPANY_NAME) || '';
  },

  saveSummaryMeetingDate: (date: string): void => {
    if (!date) {
      window.localStorage.removeItem(STORAGE_KEYS.SUMMARY_MEETING_DATE);
      return;
    }
    window.localStorage.setItem(STORAGE_KEYS.SUMMARY_MEETING_DATE, date);
  },

  getSummaryMeetingDate: (): string => {
    return window.localStorage.getItem(STORAGE_KEYS.SUMMARY_MEETING_DATE) || '';
  },

  // アプリ設定
  saveSettings: (settings: Record<string, any>): void => {
    window.localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },
  
  getSettings: (): Record<string, any> => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }
};

// ユーティリティ関数
export const storage = {
  // 全てのデータをクリア
  clearAll: (): void => {
    apiKeyStorage.clear();
    localStorage.clearCustomPrompt();
    window.localStorage.removeItem(STORAGE_KEYS.SETTINGS);
  },
  
  // セキュリティ情報を表示
  getSecurityInfo: () => {
    const mode = storageMode.getMode();
    const modeDescriptions = {
      session: 'セッションストレージ（タブを閉じると自動削除）',
      persistent: 'ローカルストレージ（永続保存・難読化済み）',
      none: '保存しない（毎回入力が必要）'
    };
    
    return {
      apiKeyStorage: modeDescriptions[mode],
      apiKeyEncryption: '簡易難読化済み',
      promptStorage: 'ローカルストレージ（永続保存）',
      currentMode: mode,
      recommendations: [
        mode === 'persistent' ? '⚠️ 永続保存モード：共有PCでは注意してください' : 'セキュリティ重視モード',
        'プライベートブラウジングモードの使用を推奨',
        '使用後は「すべてのデータをクリア」を実行してください'
      ]
    };
  }
};
