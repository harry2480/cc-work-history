---
name: pr-screenshot
description: UI 変更を含む PR で、撮影すべき画面と操作を洗い出し、スクリーンショットを PR 本文に載せる手順を案内する
---

# PR Screenshot

UI 変更を含む PR に、変更後の画面のスクリーンショットを載せるためのスキル。

## 前提（このリポジトリの制約）

- アプリは Electron のデスクトップアプリで、ブラウザから URL で開ける画面はない。renderer を Vite の dev サーバーだけで開いても `window.api` がないため画面は動かない
- Electron のウィンドウを自動で撮影する仕組み（Playwright の `_electron` など）はまだ導入していない
- 画像のアップロード先（ストレージ）は用意していない。`gh` CLI では PR 本文に画像をアップロードできない

そのため、撮影とアップロードはユーザーに依頼し、Claude は「何を撮るか」の洗い出しと PR 本文の整形を担当する。

## 使い方

```
/pr-screenshot
/pr-screenshot "ホバー時のツールチップも撮って"
```

## ワークフロー

### Step 1: 変更差分の分析

```bash
git branch --show-current
gh pr list --head "$(git branch --show-current)" --json number --jq '.[0].number'
git diff --name-only main...HEAD
```

変更ファイルから影響する画面を推定する（パスは `apps/desktop/src/renderer/` から）。

| 変更箇所 | 撮る画面 |
|---|---|
| `pages/timeline-page.tsx`, `features/timeline/`, `features/session-detail/` | タイムライン（詳細パネルを開いた状態） |
| `pages/dashboard-page.tsx`, `features/dashboard/` | ダッシュボード |
| `pages/session-list-page.tsx`, `features/session-list/` | セッション一覧 |
| `features/filters/` | フィルタを使う画面（タイムライン・セッション一覧） |
| `pages/settings-page.tsx` | 設定 |
| `components/`, `globals.css`, `lib/config/palette.ts` | 影響が広い。タイムライン + 変更に関係する画面 |

**UI に関係しない変更のみの場合**（main プロセス・マイグレーション・テストのみなど）は「スクリーンショット不要」と報告して終了する。

### Step 2: 撮影リストをユーザーに渡す

画面ごとに「開く画面」「操作（ホバー、パネルを開く、ズームなど）」「確認してほしい点」を箇条書きにして提示し、撮影を依頼する。

- アプリの起動は `pnpm dev`（起動するかどうかはユーザーに確認する）
- 実データを写したくない場合は、`CC_WORK_HISTORY_LOG_DIR=<リポジトリの絶対パス>/apps/desktop/test/fixtures/claude-projects` と `CC_WORK_HISTORY_USER_DATA_DIR=<一時ディレクトリ>` を付けて起動すると、フィクスチャのログだけで表示できる（`CC_WORK_HISTORY_STUB_SUMMARY=true` で概要生成も Stub になる）
- macOS では `Cmd+Shift+4` → `Space` でウィンドウ単位で撮影できる
- スクリーンショットに個人のプロジェクト名・パス・会話内容が写っていないか確認してもらう

### Step 3: PR 本文の整形

ユーザーが GitHub の PR 画面に画像をドラッグ&ドロップして得た URL を受け取ったら、`gh pr edit` で本文に `## スクリーンショット` セクションを追加 / 置換する（更新前に内容をユーザーに見せて確認する）。

```markdown
## スクリーンショット

| 説明1 | 説明2 |
|:---:|:---:|
| <img src="URL1" width="400" /> | <img src="URL2" width="400" /> |
```

既存の `## スクリーンショット` セクションがあれば置換し、なければ `## Test plan` の直前に挿入する。

## 注意事項

- 自動撮影の仕組み（Playwright の Electron サポート）を導入したら、このスキルを撮影まで自動化する形に書き直す
