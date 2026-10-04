# CC Work History

Claude Code のローカルセッションログを解析し、作業履歴をカレンダー／タイムライン形式で可視化するデスクトップアプリケーションです。
Claude Code と普段どおりチャットするだけで、セッションの概要やタグが自動生成・更新され、「いつ・何を・どのくらい作業したか」を一目で把握できます。

## 主な機能

- `~/.claude/projects/` 配下の JSONL ログを自動検出・解析し、ローカルの SQLite にキャッシュ
- 週単位のタイムラインで、セッションを色付きの水平バーとして表示（色分けはプロジェクト／タグ／ステータスで切り替え）
- ファイル監視によるリアルタイム更新と、進行中セッションの強調表示
- Claude CLI を使ったセッション概要・タグの自動生成（追加の API キー不要）
- セッション詳細パネル、フィルタ・検索、ダッシュボード、セッション再開（`claude -r` 相当）
- 完全ローカル動作。外部へのデータ送信なし

詳細は [要件定義](docs/要件定義.md) と [サービスコンセプト](docs/サービスコンセプト.md) を参照してください。

## 技術スタック

| 分類 | 技術 |
|---|---|
| アプリ形態 | Electron |
| フロントエンド | React 18 + TypeScript + Vite |
| UI | Tailwind CSS + shadcn/ui |
| 状態管理 | Zustand |
| データ保存 | SQLite（better-sqlite3） |
| ファイル監視 | chokidar |
| Claude 連携 | Claude CLI（子プロセス呼び出し） |
| ビルド・配布 | electron-builder |
| 品質 | Vitest + dependency-cruiser + Biome |

## プロジェクト構成

```text
cc-work-history/
├── .claude/                # AI エージェント用の Skills と Commands
├── .github/workflows/      # CI（lint・型チェック・テスト・依存方向チェック）
├── docs/                   # 要件定義・設計規約
└── apps/desktop/
    ├── src/
    │   ├── main/           # Electron main プロセス
    │   │   └── backend/    # DDD 4層（domain / application / infrastructure / presentation）
    │   ├── preload/        # contextBridge で window.api を公開
    │   ├── renderer/       # React UI
    │   └── shared/         # IPC の型定義
    └── test/               # unit / integration / e2e
```

## 開発コマンド

| コマンド | 内容 |
|---|---|
| `pnpm dev` | 開発サーバー起動 |
| `pnpm verify` | 品質チェック（lint → typecheck → unit test → depcruise） |
| `pnpm test:unit` | Unit テスト実行 |
| `pnpm test:integration` | Integration テスト実行 |
| `pnpm lint:fix` | 自動フォーマット・Lint 適用 |
| `pnpm merge [PR]` | PR マージ＋ブランチ削除・リモート追跡ブランチ削除 |
| `pnpm knip` | 未使用コード検出 |

## ドキュメント

| ドキュメント | 内容 |
|---|---|
| [要件定義](docs/要件定義.md) | 機能要件・非機能要件・技術選定 |
| [サービスコンセプト](docs/サービスコンセプト.md) | サービス概要と期待される効果 |
| [実装計画](docs/実装計画.md) | Phase 0〜3 の作業分解と未決事項 |
| [アーキテクチャ](docs/アーキテクチャ.md) | main プロセスの DDD 4層と IPC の設計規約 |
| [フロントエンドアーキテクチャ](docs/フロントエンドアーキテクチャ.md) / [フロントエンド規約](docs/フロントエンド規約.md) | renderer の構成と規約 |
| [リポジトリ層設計規約](docs/リポジトリ層設計規約.md) | SQLite アクセスの規約 |
| [インフラストラクチャ規約](docs/インフラストラクチャ規約.md) | ビルド・配布・データ保存 |
| [品質チェック・テスト規約](docs/品質チェック・テスト規約.md) / [テストガイドライン](docs/テストガイドライン.md) | 品質チェックとテスト方針 |
| [スタイルガイド](docs/スタイルガイド.md) | Tailwind CSS のスタイルルール |
| [Loop Engineering](docs/loop-engineering.md) | Issue → 実装 → PR を反復する運用（任意） |

## AI エージェントでの開発

このリポジトリは Claude Code などの AI エージェントで開発することを前提に、`CLAUDE.md` / `AGENTS.md` に設計ルールを、`.claude/` に定型作業のコマンドをまとめています。依存方向は dependency-cruiser で機械的にチェックします。

### PR マージワークフロー

```bash
# 現在のブランチの PR をマージ
pnpm merge

# 指定した PR をマージ
pnpm merge 42
```
