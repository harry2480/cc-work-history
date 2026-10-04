---
description: monorepo・ビルド・配布・CI など、インフラ構成の修正を行う
---

## タスク

1. [docs/インフラストラクチャ規約.md](docs/インフラストラクチャ規約.md) を読み、monorepo 構成・ビルド（electron-vite）・配布（electron-builder）・データ保存・外部依存の方針を把握する

2. CI を触る場合は `.github/workflows/` の該当ファイルと [docs/品質チェック・テスト規約.md](docs/品質チェック・テスト規約.md) を確認する

3. ユーザーの指示に従って実装し、`pnpm verify` を通す

## 関連ドキュメント

- main プロセスの修正も必要な場合は [docs/アーキテクチャ.md](docs/アーキテクチャ.md) も参照
- renderer の修正も必要な場合は [docs/フロントエンド規約.md](docs/フロントエンド規約.md) も参照
- Loop 関連 workflow を触る場合は [docs/loop-engineering.md](docs/loop-engineering.md) の安全境界に従う
