---
description: 指定された機能のE2Eテストを作成する（E2E環境は未導入のため、現状は代替テストを案内する） (project)
---

## 対象

$ARGUMENTS

## 前提: E2E 環境はまだない

`docs/テストガイドライン.md` のとおり、E2E テスト（Playwright の Electron サポート `_electron.launch`、配置先 `apps/desktop/test/e2e/`）は **未導入（Phase 2 以降）**。
Playwright の依存、`test:e2e` スクリプト、CI のジョブはまだ存在しない。存在しないコマンドを実行したり、テスト基盤を勝手に追加したりしない。

## タスク

### 1. 対象の特定

- 引数が指定されている場合: その機能を対象とする
- 引数がない場合: `git diff --name-only` → `git diff --name-only main...HEAD` の順で変更ファイルを確認し、影響する画面（`apps/desktop/src/renderer/pages/`）と機能（`features/`）を特定する

### 2. ユーザーに方針を確認する

E2E 環境がないことを伝え、どちらにするかを聞く。

- **A. 既存のテスト基盤でフローを担保する（推奨・すぐできる）**
- **B. E2E 環境を導入する** — 依存追加・ビルド・CI に影響するため、別 Issue として切り出すことを提案する

### 3. A を選んだ場合: 代替テストを書く

E2E で確認したいフロー（画面表示 → 操作 → 反映）を、次の 2 つに分けて担保する。

| 確認したいこと | テスト | 配置・実行 |
|---|---|---|
| 画面の表示と操作（クリック → `window.api` の呼び出し → 再取得） | React Testing Library。`window.api` をモックする | `apps/desktop/test/unit/renderer/features/{feature}/components/*.test.tsx`、`pnpm test:unit` |
| IPC の loader / action から DB までの流れ | Electron を起動せず、ハンドラ関数を一時ディレクトリの SQLite で直接呼ぶ | `apps/desktop/test/integration/main/backend/...`、`pnpm test:integration` |

- 既存例: `test/unit/renderer/features/session-detail/components/annotation-section.test.tsx`、`test/integration/main/backend/infrastructure/repositories/sqlite-session-annotation.repository.test.ts`
- ロケーターは `getByRole` / `getByLabelText` / `getByText` を優先する
- 細かいバリデーションやエッジケースは domain / application の unit テストで担保し、ここでは主要フローに集中する
- 実際のセッションログをフィクスチャにしない（`test/fixtures/claude-projects/` の最小 JSONL を使う）

### 4. B を選んだ場合: 導入時の方針（参考）

`docs/テストガイドライン.md` の「E2Eテスト」節に従う。

- `_electron.launch` でビルド済みアプリを起動する
- `CC_WORK_HISTORY_LOG_DIR` をフィクスチャ、`CC_WORK_HISTORY_USER_DATA_DIR` を一時ディレクトリに向け、`CC_WORK_HISTORY_STUB_SUMMARY=true` で Claude CLI を Stub にする
- 対象は「起動 → タイムライン表示」「セッション選択 → 詳細パネルの表示・編集」から始める

### 5. 実行

書いたテストを実行し、最後に `pnpm verify` を通す。
