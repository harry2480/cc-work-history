---
description: 現在の変更に対して設計レビューを行う (project)
---

## 現在の状況

- 現在のブランチ: !`git branch --show-current`
- 変更ファイル: !`git diff --name-only main...HEAD 2>/dev/null; git diff --name-only`

## タスク

以下の手順で現在のブランチの変更内容に対して設計レビューを行ってください：

1. **変更内容の把握**: `git diff main...HEAD` と未コミットの `git diff` で差分を取得し、変更内容を把握する。必要に応じて関連ファイルも読み込む。

2. **ガイドラインの参照**: 変更対象に応じて以下を参照する（パスは `apps/desktop/` から）。
   - `src/main/backend/` 配下: [docs/アーキテクチャ.md](docs/アーキテクチャ.md)
   - `src/main/backend/infrastructure/repositories/`・`infrastructure/db/` 配下: [docs/リポジトリ層設計規約.md](docs/リポジトリ層設計規約.md)
   - `src/renderer/` 配下: [docs/フロントエンド規約.md](docs/フロントエンド規約.md)、[docs/フロントエンドアーキテクチャ.md](docs/フロントエンドアーキテクチャ.md)、[docs/スタイルガイド.md](docs/スタイルガイド.md)
   - `src/shared/ipc-contract.ts`・`src/preload/` 配下: [docs/アーキテクチャ.md](docs/アーキテクチャ.md) の presentation 層の節
   - `test/` 配下: [docs/テストガイドライン.md](docs/テストガイドライン.md)

3. **レビュー実施**: 以下の観点でレビューを行う。
   - **アーキテクチャ**: 依存方向（`presentation → application → domain ← infrastructure`）、層ごとの責務、renderer が main を import していないか
   - **IPC**: チャンネルと型が `src/shared/ipc-contract.ts` にだけ定義されているか、loader / action の入口で引数を検証しているか、DTO にドメインモデルを渡していないか
   - **import パス**: main・preload・shared は相対パス、renderer は `@/`（renderer 内）と `@shared/` のエイリアスを使っているか
   - **型定義**: 適切な型が定義されているか（`any` 禁止）
   - **命名**: kebab-case + レイヤーサフィックス、変数名・関数名が適切か

4. **結果報告**: 以下の形式でレビュー結果を報告する。重大な問題がない場合は「✅ 設計上の問題は見つかりませんでした」と報告する。

```
## レビュー結果

### ✅ 良い点
- ...

### ⚠️ 改善提案
- **[ファイル名:行番号]** 問題の説明
  - 提案: ...

### ❌ 要修正
- **[ファイル名:行番号]** 問題の説明
  - 理由: ...
  - 修正案: ...
```
