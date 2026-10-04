---
name: fix-error
description: エラーを修正する。エラーメッセージから原因を特定し、アーキテクチャルールに従って修正する
---

# エラー修正スキル

ユーザーがエラーメッセージを貼り付けて「直して」と指示したときに適用する。

## 手順

1. **エラーメッセージを解析** — 種類と発生箇所（main / preload / renderer / テスト / ビルド）を特定する
2. **原因を特定** — コードを読んで根本原因を調査する
3. **修正を実施** — アーキテクチャルールに違反しない形で修正する
4. **検証** — `pnpm verify` で全チェックがパスすることを確認する（DB・Adapter を触ったら `pnpm test:integration` も）

## よくあるエラーと対処

### 型エラー（TypeScript）
- `pnpm typecheck` で確認する（main/preload・renderer・test の 3 つの tsconfig を検査）
- 型の不一致を修正する。`any` は使わない
- main と renderer の型がずれている場合は `src/shared/ipc-contract.ts` を正として揃える

### 依存方向違反（dependency-cruiser）
- `pnpm depcruise` で確認する
- 依存方向: `presentation → application → domain ← infrastructure`
- application から infrastructure を import している → domain の Gateway / Repository interface 経由に直す
- loaders / actions / events から domain・infrastructure を import している → composition で組み立てて UseCase を渡す
- renderer から `src/main/` や Node.js 組み込みモジュールを import している → `window.api`（IPC）経由に直す
- domain から `electron`・Node.js 組み込みモジュールを import している → Gateway に切り出す

### IPC のエラー
- `No handler registered for '...'` → `presentation/composition/ipc-handlers.composition.ts` での `ipcMain.handle` 登録漏れ
- `window.api.xxx is not a function` → `src/preload/index.ts` へのメソッド追加漏れ
- `InvalidIpcRequestError` → renderer から送った引数が loader / action の検証に通っていない

### SQLite / マイグレーションのエラー
- `マイグレーションのファイル名が不正です` / `連番が 1 から連続していません` → `infrastructure/db/migrations/` のファイル名を `<4 桁の連番>_<説明>.sql` にし、番号を詰める
- `DB のスキーマ（vN）がアプリの想定より新しい` → 別ブランチで作った開発用 DB が残っている。開発時の userData（`<userData>-dev`）を消すか `CC_WORK_HISTORY_USER_DATA_DIR` で別ディレクトリを使う（削除はユーザーに確認してから）
- better-sqlite3 の `NODE_MODULE_VERSION` 不一致 → Node.js と Electron の ABI が合っていない。勝手に再ビルドせず、エラー全文を添えてユーザーに確認する

### lint エラー
- `pnpm lint:fix` で自動修正する

## ルール

- 修正時もアーキテクチャルール（依存方向、命名規約、`index.ts` バレル禁止）を守る
- エラーの根本原因を修正する（場当たり的な回避策や lint 抑制で済ませない）
- 修正後は必ず `pnpm verify` を実行する
