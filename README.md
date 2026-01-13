# NotebookLM用音声分割ツール

## 概要

大きな音声ファイルを NotebookLM に最適なサイズ（200MB以下）に自動分割するツールです。ログインやAPIキー設定は一切不要で、ブラウザ内で完結してプライバシーを保護しながら処理できます。

**主な機能**：

- **音声録音**: マイク音声をブラウザ上で録音
- **自動分割**: NotebookLMの制限（200MB）を考慮し、自動で分割
- **最適な命名規則**: `1_ファイル名.mp3`, `2_ファイル名.mp3` 形式で出力。NotebookLMでの内容把握が容易になります。
- **完全ローカル処理**: Web Audio APIを使用し、音声データを一切サーバーに送信しません。

## 使い方

1. **音声ファイルの選択**: 「音声ファイルを準備」から録音またはファイルを選択
2. **分割実行**: 200MBを超えるファイルは自動的に分割モードになります
3. **ダウンロード**: 分割されたファイルを個別、またはZIPで保存
4. **NotebookLMへ投入**: ダウンロードしたファイルをNotebookLMにドラッグ＆ドロップ

### Handling Very Large Files (multi-GB)

The in-browser splitter is optimized for files up to a few hundred MB. For multi-GB files, browsers can run out of memory or stall. To support very large files, use the included local helper which requires a native `ffmpeg` installation:

1. Install ffmpeg on your system (macOS: `brew install ffmpeg`, Ubuntu: `sudo apt install ffmpeg`, Windows: use the official static build).
2. Run the helper:

```bash
node tools/split_large.js /path/to/largefile.mp4 195
```

This will create a `<basename>_split` directory with parts sized approximately to the specified maximum (in MB). The helper uses native `ffmpeg` and can handle multi-GB inputs without loading the entire file into browser memory.

## 開発者向け

### セットアップ

```bash
npm install
npm run dev
```

### ビルド

```bash
npm run build
```
