# Project-specific Copilot Instructions

## Quick phrases

一般的な作業を自然言語で直接呼び出すには、アシスタントとの会話で以下のフレーズを使うと良いでしょう。

- **PR作成して** – PR作成チェックリストとコマンドを開始する。
- **UIデバッグして** – Chrome DevTools MCP のデバッグ手順を開始する。
- **デプロイして** – `develop` から `main` へのデプロイ手順を実行する。
- **曖昧点質問して** – 計画用の `AskUserQuestion` ワークフローを起動する。
- **リファクタしてください** – ブランチのリファクタリングガイダンスを実行する。
- **レビューして** – PRレビュー用テンプレートに従ってレビューを行う。
- **UX要件作って** – UX要件のワークフローを開始し Issue を作成する。

- **覚えといて / 記憶して** – 「Agent Memory」ワークフローを起動し、知見を Markdown ファイルとして保存する。
- **〜について何話したっけ？ / 記憶を確認して** – 記憶ディレクトリ内の `rg` 検索を実行し、関連情報を提示する。
- **記憶を整理して** – 重複したメモリの統合や、古い情報の削除を提案する。

（これらのフレーズは提案です。アシスタントはこれらを解釈し、対応するセクションを表示するべきです。）

---

## Agent Memory (記憶・ナレッジ管理)

## タスク
ユーザーの指示、または自発的な判断に基づき、会話を越えた知識を永続化します。

### 1. 保存場所と構造
- **ベースパス**: `.github/skills/agent-memory/memories/`
- **ルール**: カテゴリ別のフォルダを作成し、kebab-case で命名する。

### 2. ファイル作成の手順
ユーザーから「覚えといて」等の指示があった場合、以下の `cat` コマンドによるファイル生成を提案してください。

```bash
# カテゴリフォルダの作成
mkdir -p .github/skills/agent-memory/memories/<category-name>/

# ファイル生成（フロントマター必須）
cat > .github/skills/agent-memory/memories/<category-name>/<filename>.md << 'EOF'
---
summary: "<内容の簡潔な要約（1〜2行）>"
created: $(date +%Y-%m-%d)
status: resolved
---

# <タイトル>

- 文脈: 
- 詳細: 
- 次のステップ:

## 現在のブランチからPRを作成する


## 引数

$ARGUMENTS

## タスク

現在の変更から新しいブランチを作成し、develop ブランチに対してPRを作成します。

### 0. リモート環境の検出

フォーク環境か通常環境かを検出し、適切なリモートとリポジトリを設定：

```bash
# upstreamリモートの存在確認
if git remote get-url upstream >/dev/null 2>&1; then
  # フォーク環境: upstreamを使用
  TARGET_REMOTE="upstream"
  TARGET_REPO=$(git remote get-url upstream | sed -E 's#.*github.com[:/](.+/.+)\.git$#\1#' | sed 's/\.git$//')
  echo "✓ フォーク環境を検出: ${TARGET_REPO} を使用"
else
  # 通常環境: originを使用
  TARGET_REMOTE="origin"
  TARGET_REPO=$(git remote get-url origin | sed -E 's#.*github.com[:/](.+/.+)\.git$#\1#' | sed 's/\.git$//')
  echo "✓ 通常環境: ${TARGET_REPO} を使用"
fi
```

### 0.1 リモート接続の確認

設定されたリモートに到達可能か確認：

```bash
# リモートの接続確認
if ! git ls-remote --exit-code ${TARGET_REMOTE} >/dev/null 2>&1; then
  echo "❌ エラー: ${TARGET_REMOTE} リモートに接続できません"
  echo "リモートURL: $(git remote get-url ${TARGET_REMOTE})"
  echo ""
  echo "以下を確認してください："
  echo "1. ネットワーク接続"
  echo "2. リモートURLの正確性"
  echo "3. リポジトリへのアクセス権限"
  exit 1
fi
echo "✓ ${TARGET_REMOTE} リモートへの接続確認完了"
```

### 1. 事前確認

```bash
# 最新のdevelopをfetch
git fetch ${TARGET_REMOTE} develop

# 現在のブランチ名とワーキングツリーの状態を確認
git branch --show-current
git status

# ${TARGET_REMOTE}/developとの差分コミットを確認
git log ${TARGET_REMOTE}/develop..HEAD --oneline
```

### 1.1 マージ済みブランチの扱い（Squash運用）

このリポジトリは **Squashマージ運用** のため、マージ済みブランチの使い回しは行わない。
次の作業は **必ず最新の develop から新規ブランチを作成** する。

現在のブランチに新しい変更がある場合は、以下で新規ブランチへ移す：

```bash
# 未コミットの変更がある場合（stash禁止のため一時コミットで移す）
git add -A
git commit -m "wip: temporary"
git checkout develop
git pull --rebase ${TARGET_REMOTE} develop
git checkout -b <新しいブランチ名>
git cherry-pick <wipコミット>

# すでにコミットがある場合
git checkout develop
git pull --rebase ${TARGET_REMOTE} develop
git checkout -b <新しいブランチ名>
git cherry-pick <コミット範囲>
```

### 2. 新しいブランチの作成（必要な場合）

現在のブランチが `develop` または `main` の場合のみ、新しいブランチを作成：

差分コミットの内容を分析し、適切なブランチ名を生成する：
- `fix/xxx` - バグ修正
- `feat/xxx` - 新機能
- `chore/xxx` - メンテナンス・設定変更

```bash
# 新しいブランチを作成して切り替え（現在のコミットを引き継ぐ）
git checkout -b <新しいブランチ名>
```

既にfeatureブランチにいる場合はブランチ作成をスキップ。

> 重要: `develop` / `main` 上でコミットしないこと。
> 未コミットの変更がある場合は **ブランチ作成を先に行う**。

もし `develop` / `main` で **未コミットの変更が無い** 場合は、先に最新化してからブランチを作成する：

```bash
git pull --rebase ${TARGET_REMOTE} <develop または main>
git checkout -b <新しいブランチ名>
```

### 3. 未コミットの変更をコミット

`git status` で未コミットの変更（staged/unstaged）がある場合は、不要な変更を除外したうえでコミットする：

```bash
# 不要な変更がある場合は取り消す（例）
git restore <ファイル>

# 未追跡ファイルが不要なら削除（必要な場合のみ）
git clean -fd

# 変更をステージング（全変更）
git add -A

# 変更を部分的にステージングしたい場合
git add -p

# コミット（変更内容に応じたメッセージ）
git commit -m "<コミットメッセージ>"
```

コミット前に、意図しないファイルが含まれていないか確認する：

```bash
git status
git diff --stat
```

### 4. 最新のdevelopにrebase

```bash
git rebase ${TARGET_REMOTE}/develop
```

### 5. 差分の確認

${TARGET_REMOTE}/develop との差分を確認：

```bash
# コミット一覧
git log ${TARGET_REMOTE}/develop..HEAD --oneline

# 変更ファイルの統計
git diff ${TARGET_REMOTE}/develop...HEAD --stat
```

差分コミットが 0 件の場合は PR 作成を中止する。

### 6. PR作成

#### 6.1 リモートにpush

リモートブランチの存在を確認し、適切なpushコマンドを実行：

```bash
# リモートブランチが存在すればforce-with-lease、なければ通常push
git ls-remote --heads origin <ブランチ名> | grep -q <ブランチ名> && \
  git push origin <ブランチ名> --force-with-lease || \
  git push -u origin <ブランチ名>
```

#### 6.2 PRタイトルと本文の生成

まず `.github/PULL_REQUEST_TEMPLATE.md` を読み込み、テンプレートに従ってPR本文を生成する。

- コミットメッセージを分析し、以下のルールでPRを作成：

- **言語**: PRのタイトルと本文は日本語で作成する。レビューしやすい簡潔な日本語を心がける。
- **タイトル**: コミットが1つの場合はそのメッセージを使用、複数の場合は変更内容を要約（70文字以内）
- **本文**: PRテンプレートの形式に従い、各セクションを埋める
  - `# 変更の概要`: 変更内容を箇条書きで記載
  - `# 変更の背景`: 変更理由と関連Issue（あれば `closes #<issue番号>`）
  - `# スクリーンショット`: フロントエンドの変更がない場合はチェックを入れる
  - `# CLAへの同意`: チェックを入れない（ユーザーが確認して入れる）

#### 6.3 gh pr create の実行

`.github/PULL_REQUEST_TEMPLATE.md` を読み込み、各セクションを適切に埋めてPRを作成する。

- フロントエンド変更がない場合はスクショのチェックを入れる
- CLAのチェックはユーザーに任せる（チェックを入れない）

```bash
# リポジトリ指定オプションを動的に設定
if [ "${TARGET_REMOTE}" = "upstream" ]; then
  REPO_OPTION="--repo ${TARGET_REPO}"
else
  REPO_OPTION=""
fi

gh pr create ${REPO_OPTION} --base develop --title "<タイトル>" --body "$(cat <<'EOF'
<テンプレートに従った本文>
EOF
)"
```

### 7. PR差分の検証

PR作成後、意図した変更のみが含まれているか必ず確認する：

```bash
# PRの差分ファイル一覧を取得
gh pr diff <PR番号> --name-only
```

- 今回の作業で変更したファイル以外が含まれていないか確認する
- 余分な変更がある場合は、ブランチの起点が `develop` でない可能性が高い
  - `git rebase --onto develop <元のブランチ> <現在のブランチ>` で修正し、force push する
- 問題がなければ次のステップへ進む

### 8. 完了報告

PRのURLを表示：

```
✅ PR作成完了
Repository: ${TARGET_REPO}
PR URL: <PR URL>
```

## "Chrome DevTools MCPを使ってUI問題をデバッグする"

## 引数

$ARGUMENTS

## 前提条件

- Chrome DevTools MCP (`mcp__chrome-devtools__*`) が利用可能であること
- ローカル開発サーバーが起動していること

Chrome DevTools MCPが設定されてない場合は、以下のコマンドでセットアップします。
`claude mcp add chrome-devtools npx chrome-devtools-mcp@latest`

## タスク

Chrome DevTools MCPを使ってUI問題を特定・修正します。

### 1. 問題の確認

引数またはユーザーからの情報を整理：
- **対象URL**: デバッグするページ
- **問題の種類**: レイアウト崩れ、はみ出し、表示されない、スタイル不正など
- **再現条件**: 画面サイズ、操作手順など

### 2. 環境のセットアップ

```javascript
// ページを開く
mcp__chrome-devtools__new_page({ url: "<対象URL>" })

// 必要に応じてビューポートをエミュレート
mcp__chrome-devtools__emulate({
  viewport: { width: 320, height: 568, deviceScaleFactor: 2, isMobile: true, hasTouch: true }  // iPhone SE
  // viewport: { width: 375, height: 812, ... }  // iPhone X
  // viewport: { width: 768, height: 1024, ... } // iPad
  // viewport: null  // リセット
})
```

### 3. 問題タイプ別の診断

#### 3.1 横はみ出し・横スクロール問題

```javascript
mcp__chrome-devtools__evaluate_script({
  function: `() => {
    const vw = window.innerWidth;
    const sw = document.body.scrollWidth;
    if (sw <= vw) return { ok: true, message: '横はみ出しなし' };

    // 原因要素を特定
    let maxRight = 0, culprit = null;
    document.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.right > maxRight) {
        maxRight = r.right;
        culprit = { tag: el.tagName, class: el.className?.slice(0,80), right: Math.round(r.right) };
      }
    });
    return { ok: false, viewportWidth: vw, scrollWidth: sw, culprit };
  }`
})
```

#### 3.2 要素が見つからない・表示されない

```javascript
// スナップショットでDOM構造を確認
mcp__chrome-devtools__take_snapshot()

// 特定のセレクタで要素を探す
mcp__chrome-devtools__evaluate_script({
  function: `() => {
    const el = document.querySelector('<セレクタ>');
    if (!el) return { found: false };
    const style = getComputedStyle(el);
    return {
      found: true,
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      rect: el.getBoundingClientRect()
    };
  }`
})
```

#### 3.3 スタイル・レイアウトの確認

```javascript
mcp__chrome-devtools__evaluate_script({
  function: `(el) => {
    const style = getComputedStyle(el);
    return {
      width: style.width,
      height: style.height,
      padding: style.padding,
      margin: style.margin,
      display: style.display,
      position: style.position,
      overflow: style.overflow
    };
  }`,
  args: [{ uid: "<要素のuid>" }]
})
```

### 4. 二分探索による原因特定

問題の原因コンポーネントが不明な場合、コメントアウトで絞り込む：

1. 対象ファイルを特定（ページのコンポーネント）
2. **半分をコメントアウト** → リロード → 問題確認
3. 問題が解消 → コメントアウト部分に原因
4. 問題が継続 → 残り部分に原因
5. 繰り返して原因コンポーネントを特定

```javascript
// リロードして確認
mcp__chrome-devtools__navigate_page({ type: "reload" })
```

### 5. 修正と確認

#### よくある修正パターン

| 問題 | 原因例 | 修正 |
|------|--------|------|
| 横はみ出し | 固定幅 `w-[756px]` | `max-w-[756px] w-full` |
| 横はみ出し | `inline-flex` | 親に `overflow-x-auto` |
| 横はみ出し | コンテナ幅超過 | `w-full` を追加 |
| 要素が見切れる | `overflow: hidden` | `overflow: visible` or 削除 |
| レスポンシブ崩れ | 固定パディング | `p-4 sm:p-6` |

#### 修正後の確認

```javascript
mcp__chrome-devtools__navigate_page({ type: "reload" })
mcp__chrome-devtools__take_screenshot({ filePath: "./screenshot-fixed.png" })
```

### 6. 完了報告

```markdown
## デバッグ完了

### 問題
<問題の説明>

### 原因
<原因の要素・スタイル>

### 修正
<変更内容>

### 確認
<スクリーンショットまたは確認結果>
```


---
description: "developからmainへのデプロイPRを作成・マージする"
---

## タスク

develop ブランチから main ブランチへのデプロイPRを作成し、確認後にマージします。

### 1. 事前確認

```bash
# 最新の状態をfetch
git fetch origin develop main

# develop と main の差分コミットを確認
git log origin/main..origin/develop --oneline
```

差分コミットがない場合は「デプロイする変更がありません」と報告して終了。

### 2. 差分の詳細表示

```bash
# コミット一覧（詳細）
git log origin/main..origin/develop --pretty=format:"- %h %s (%an)"

# 変更ファイルの統計
git diff origin/main...origin/develop --stat
```

差分の内容をユーザーに報告：
- コミット数
- 変更ファイル数
- 主な変更内容の要約

### 3. デプロイPRの作成

PRタイトルは「本番デプロイ MM/DD HH:MM」の形式（現在日時を使用）。

```bash
gh pr create \
  --base main \
  --head develop \
  --title "本番デプロイ $(date '+%m/%d %H:%M')" \
  --body "$(cat <<'EOF'
## デプロイ内容

<コミット一覧を箇条書きで記載>

## 変更ファイル数

<変更ファイル数を記載>
EOF
)"
```

PRのURLを表示。

### 4. マージ実行

```bash
# 通常マージ（admin権限でマージコミット作成）
gh pr merge --merge --admin
```

### 5. 完了報告

```
✅ デプロイ完了: main ブランチにマージされました
```


---
description: "計画の曖昧な点を構造化された質問で明確にする"
version: "2.0.0"
allowed-tools:
  - Write
  - Edit
  - Read
  - Grep
  - Glob
  - TodoRead
  - TodoWrite
  - AskUserQuestion
context: fork
agent: General-purpose
---

現在の計画ファイルを読み込み、 AskUserQuestionTool を使用して以下の点について詳細にインタビューしてください：
- プロダクト仕様
- 技術的な詳細
- UI/UX
- その他気になる点すべて

以下のフェーズに従って進めてください：

1. 不明確な点を洗い出す
2. 決定に必要な質問をユーザーに投げかける
3. 決定内容を計画に反映する
4. ユーザーに要約を提示する

不明確な点がすべて解消されるまで深掘りを続け、最終的に仕様を計画ファイルに書き込んでください。
フェーズ3の後、計画ファイルを再度確認・分析し、新たな不明確な点があればフェーズ2に戻って対応してください。

### フェーズ2: 質問の生成

<rules>
- 質問数: **2〜4個**（曖昧さのレベルに応じて調整）
- 各質問には**2〜4個の具体的な選択肢**を用意
- 各選択肢には**メリット/デメリット**を簡潔に記載
- オープンエンドな質問は避ける
- 「その他」オプションは自動追加されるため含めない
- CLAUDE.mdがある場合は、既存のパターンに沿った選択肢を提示
</rules>

### フェーズ3: 回答後の処理

<output_format>
ユーザーの回答を受けた後、以下の形式で出力してください：

## 決定事項

| 項目 | 選択 | 理由 | 備考 |
|------|------|------|------|
| データ保存方式 | データベース | スケーラビリティの要件 | マイグレーション戦略を検討 |

## 次のステップ

1. **最初のタスク**
   - 詳細...
2. **2番目のタスク**
   - 詳細...
</output_format>

---

## 重要な注意事項

- **必ずAskUserQuestionツールを使用すること** - 会話形式の質問ではなくツールを使用
- 各選択肢には必ず**メリット/デメリット**を含める
- multiSelectは控えめに使用（デフォルト: false）
- 質問生成前にCLAUDE.mdを読み、プロジェクトのパターンに合わせる

---


---
description: 現在の変更に対してリファクタリングを行う (project)
---

## 現在の状況

- 現在のブランチ: !`git branch --show-current`
- 変更ファイル: !`git diff --name-only HEAD~1 2>/dev/null || git diff --name-only --cached 2>/dev/null || git diff --name-only`

## タスク

以下の手順で現在のブランチの変更内容に対してリファクタリングを行ってください：

1. **変更内容の把握**: `git diff` で変更されたファイルの差分を取得し、変更内容を把握する。必要に応じて関連ファイルも読み込む。

2. **ガイドラインの参照**: 変更対象に応じて以下のガイドラインを参照する。
  - AGENTS.md

3. **リファクタリング実施**: 以下の観点でリファクタリングを行う。
   - **アーキテクチャ**: ガイドラインに沿ったレイヤー構成・責務分離ができているか
   - **テスト容易性**: テストしやすいモジュール設計になっているか
   - **凝集度**: 凝集度が高いモジュール設計になっているか
   - **疎結合**: 結合度が低いモジュール設計になっているか
   - **可読性**: 可読性が高いコードになっているか


---
description: "GitHub PRをレビューしてマージ判定を行う"
---

## 引数

$ARGUMENTS

## タスク

指定されたGitHub PRをレビューし、マージ可否を判定してください。

### 1. PR情報の取得

引数からPR番号またはURLを解析し、以下のコマンドでPR情報を取得：

```bash
# PR詳細
gh pr view <PR番号> --json title,body,state,author,additions,deletions,files,headRefName,baseRefName

# 差分
gh pr diff <PR番号>

# CI状況
gh pr checks <PR番号>
```

### 2. レビュー観点

以下の観点でコードをレビューしてください：

#### 機能面
- 意図した変更が正しく実装されているか
- 破壊的変更がないか
- エッジケースの考慮

#### コード品質
- CLAUDE.mdのルールに準拠しているか
- 未使用コード・デッドコードがないか
- 適切なエラーハンドリング

#### セキュリティ
- SQLインジェクション、XSSなどの脆弱性
- 機密情報の露出
- 認証・認可の問題

#### テスト
- テストが追加・更新されているか
- 既存テストへの影響

#### CI状況
- 重要なCI（Build & Tests, Unit Tests, quality）がパスしているか
- 失敗しているチェックがある場合、コードの問題か外部要因かを判断

### 3. 出力フォーマット

以下の形式で出力してください：

```markdown
## PR #<番号> Review: <タイトル>

### 概要
<PRの変更内容を簡潔に説明>

---

### 👍 良い点
<箇条書きで記載>

---

### ⚠️ 懸念点・確認事項
<重要度と共に記載>

---

### 📝 軽微な指摘
<あれば記載>

---

### 🔄 CI状況
| チェック | 状態 | 備考 |
|----------|------|------|
| Build & Tests | ✅/❌ | |
| Unit Tests | ✅/❌ | |
| quality | ✅/❌ | |
| その他 | ✅/❌ | |

---

### 結論
<総評>
```

### 4. マージ判定

最後に以下の形式でスコアを出力：

```markdown
## マージ判定: **XX点** ✅/⚠️/❌

### 内訳

| 項目 | 点数 | 理由 |
|------|------|------|
| コード品質 | /20 | |
| 破壊的変更リスク | /20 | |
| テスト | /20 | |
| 意図の明確さ | /20 | |
| レビュー容易性 | /20 | |

### 結論
<マージ可否の判断と理由。CI状況も考慮すること>
```

#### スコア基準
- **80-100点** ✅: マージOK
- **60-79点** ⚠️: 軽微な修正後マージ可
- **0-59点** ❌: 要修正

### 5. アクション確認（80点以上の場合）

スコアが80点以上の場合、`AskUserQuestion`ツールを使って次のアクションを確認してください：

```
質問: "このPRをどうしますか？"
選択肢:
- Approve + マージする (推奨)
- Approveのみ
- 何もしない
```

#### Approveする場合

以下のコマンドを実行：

```bash
gh pr review <PR番号> --approve --body "LGTM 🎉

<変更内容への感謝を1行で簡潔に>"
```

完了後に表示：
```
✅ Approved: https://github.com/team-mirai-volunteer/action-board/pull/<PR番号>
```

#### マージする場合

以下のコマンドを実行：

```bash
gh pr merge <PR番号> --squash --delete-branch
```

完了後に表示：
```
✅ Merged: https://github.com/team-mirai-volunteer/action-board/pull/<PR番号>
```

### 6. フィードバックコメント（懸念点・提案がある場合）

レビューで懸念点や改善提案がある場合、`AskUserQuestion`ツールを使ってコメントパターンを提示してください。

#### コメントパターンの生成ルール

以下の3パターンを生成し、ユーザーに選択させる：

1. **簡潔版**: 要点のみを1-2文で伝える
2. **詳細版**: 背景・理由・具体例を含めて丁寧に説明
3. **提案付き版**: 具体的な改善案やコード例を含める

#### AskUserQuestionの形式

```
質問: "PRにどのコメントを投稿しますか？"
選択肢:
- パターン1: <簡潔版の要約>
- パターン2: <詳細版の要約>
- パターン3: <提案付き版の要約>
- コメントしない
```

#### 選択後の処理

ユーザーが選択したパターンに基づいて、以下のコマンドでコメントを投稿：

```bash
gh pr comment <PR番号> --body "<選択されたコメント内容>"
```

完了後に表示：
```
✅ Commented: https://github.com/team-mirai-volunteer/action-board/pull/<PR番号>
```


---
description: "UX要件定義の壁打ちからGitHub Issue作成まで"
---

## 引数

$ARGUMENTS

## タスク

ユーザーと対話しながらUX要件を定義し、GitHub Issueを作成します。

### 1. 機能概要のヒアリング

引数で機能名やアイデアが渡された場合、それを起点に進めます。
渡されていない場合は、どんな機能を作りたいか質問してください。

### 2. 既存コードベースの調査

関連する既存機能を調査し、以下を把握：
- 類似機能の実装パターン
- 再利用可能なコンポーネント/ロジック
- データベース構造

調査には`Task`ツール（subagent_type=Explore）を使用してください。

### 3. 論点の洗い出しと質問

`AskUserQuestion`ツールを使って、以下の観点で論点を整理：

#### 必須の論点
- **何を**: 機能の具体的な内容
- **誰に**: ターゲットユーザー
- **どこで**: 画面/導線
- **どう見せる**: UI/表示形式

#### 機能に応じた追加論点
- 競争/ランキング系 → 指標、公平性、集計期間
- 入力フォーム系 → バリデーション、エラー表示
- 表示系 → 未ログイン時の挙動、レスポンシブ対応

**注意**: 一度に4つ以上の質問を投げない。段階的にヒアリングすること。

### 4. UX要件ドキュメントの作成

以下の構成でドキュメントを作成：

```markdown
# {機能名} UX要件定義

## 機能概要
{1-2文で説明}

## UX要件サマリー
| 項目 | 内容 |
|------|------|
| ... | ... |

## 画面構成
### 1. {画面名}
{詳細な画面仕様}

## ユーザーストーリー
### ストーリー1: {タイトル}
> ユーザーとして、{目的}を達成したい。

**受け入れ条件:**
- {条件1}
- {条件2}

## MVP範囲
### MVP（Phase 1）に含める
- [ ] {タスク1}
- [ ] {タスク2}

### MVP後（Phase 2）
- [ ] {将来タスク1}

## 補足事項
{エッジケース、例外処理など}
```

### 5. ユーザー確認

ドキュメント作成後、`ExitPlanMode`で承認を求めます。
修正要望があれば反映してください。

### 6. GitHub Issue作成

承認後、以下のコマンドでIssueを作成：

```bash
gh issue create --title "{機能名}の追加" --body "$(cat <<'EOF'
{UX要件ドキュメントの内容}
EOF
)"
```



## 出力

最終的に以下を出力：
1. GitHub Issue URL
