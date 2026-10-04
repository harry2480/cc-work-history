# CC Work History

Claude Code のローカルセッションログを解析し、作業履歴をカレンダー／タイムラインで可視化する Electron デスクトップアプリ。要件は [docs/要件定義.md](docs/要件定義.md)。

## 使い方（利用者向け）

- `pnpm dev` で開発サーバーを起動
- `pnpm verify` で品質チェック（変更後に実行）
- 機能を追加したいときは Claude Code に「〇〇な機能を作って」と指示するだけでOK
- エラーが出たらエラーメッセージを貼り付けて「直して」と指示

### コマンド一覧

```sh
pnpm dev               # 開発サーバー起動（Electron + Vite）
pnpm verify            # lint → typecheck → unit test → depcruise
pnpm build             # electron-vite で main / preload / renderer をビルド
pnpm dist              # 実行中の OS 向けにパッケージを作る（署名なし、dist:mac / dist:win / dist:linux もあり）
pnpm test:unit         # Unit テスト
pnpm test:integration  # Integration テスト（SQLite・フィクスチャ JSONL を使用）
pnpm lint:fix          # 自動フォーマット
pnpm knip              # 未使用コード検出
scripts/loop-once.sh   # Loopを1回だけ実行
scripts/loop.sh        # 最大5回までLoopを反復（LOOP_MAX_ITERATIONSで調整）
```

Loopを使う場合は [docs/loop-engineering.md](docs/loop-engineering.md) の初期設定、Issue信頼境界、auto-merge条件に従う。Loop関連コマンドは `.claude/commands/loop-*.md` に定義する。

---

## Claude Code への指示（利用者は読まなくてOK）

### アーキテクチャ

pnpm workspace monorepo。`apps/desktop/` に Electron アプリ（main / preload / renderer / shared）。

main プロセスのバックエンド (`src/main/backend/`) は DDD 4層構造:

```
依存方向: presentation → application → domain ← infrastructure
```

- **domain** — ビジネスルール。外部依存なし（Electron・Node.js API も参照しない）。最内層
- **application** — UseCase。domain のみ依存（infrastructure 直接参照禁止、Gateway interface 経由）
- **infrastructure** — Gateway/Repository 実装。domain の interface を implements
- **presentation** — composition（唯一の DI ポイント、全層参照可）、loaders（読み取りの IPC ハンドラ）、actions（副作用の IPC ハンドラ）、events（main → renderer 通知）

renderer (`src/renderer/`) は React 18 + Vite。main のコードは import せず、preload が公開する `window.api` と `src/shared/` の型にのみ依存する。

### ファイル配置ルール

```
src/main/backend/
├── domain/
│   ├── models/          # ドメインモデル (.model.ts)
│   ├── services/        # ドメインサービス (.service.ts)
│   ├── gateways/        # Gateway interface (.gateway.ts)
│   └── repositories/    # Repository interface (.repository.ts)
├── application/
│   └── usecases/        # UseCase (.usecase.ts)
├── infrastructure/
│   ├── adapters/        # Gateway 実装 (.adapter.ts) — 本番 + Stub
│   ├── repositories/    # Repository 実装 (.repository.ts, better-sqlite3)
│   └── db/              # SQLite 接続・マイグレーション
└── presentation/
    ├── composition/     # DI組み立て (.composition.ts)
    ├── loaders/         # データ取得 (.loader.ts, ipcMain.handle)
    ├── actions/         # 副作用 (.action.ts, ipcMain.handle)
    └── events/          # renderer へのプッシュ通知 (.event.ts)
```

### Key Rules

- ファイル命名: kebab-case + レイヤーサフィックス
- Rich Domain Model 必須。バリデーション・生成はモデル自身のメソッドで行う
- サービス（UseCase, Domain Service）はクラスベース + コンストラクタ DI。関数エクスポート禁止
- Domain 層のエラーは `Result<T, E>` 型で返す。Application/Infrastructure は throw
- 外部プロセス・ファイルシステムに触れる Gateway（ログ読み取り、ファイル監視、Claude CLI、git）は必ず Stub 実装を用意し、Composition で環境変数に応じて切り替え
- `index.ts` バレルエクスポート禁止
- IPC のチャンネルと型は `src/shared/ipc-contract.ts` にだけ定義する。renderer からの引数は loader / action の入口で検証する
- renderer で Node.js API を使わない。`contextIsolation: true` / `nodeIntegration: false` / `sandbox: true` を維持する
- `~/.claude/projects/` のログは読み取り専用。外部へのネットワーク通信を追加しない（Claude CLI 呼び出しを除く）

### テスト

- Unit: domain + application（Gateway はモック、外部依存なし）、renderer の純粋関数
- Integration: infrastructure（一時ディレクトリの SQLite とフィクスチャ JSONL を使う）
- テストパス: `test/unit/`, `test/integration/`, `test/e2e/`（ソース構造を mirror）
- 実際のセッションログをフィクスチャとしてコミットしない

### 品質チェック

`pnpm verify` は lint → typecheck → unit test → depcruise を順に実行する。
コード変更後は必ず `pnpm verify` を実行して全パスすることを確認する。

### 詳細ルール

詳細な設計ルールは必要に応じて docs/ を読むこと:

- docs/要件定義.md — 機能要件・非機能要件・技術選定
- docs/実装計画.md — フェーズごとの作業分解と未決事項
- docs/アーキテクチャ.md — DDD 4層・IPC・依存ルール・Gateway 一覧
- docs/フロントエンドアーキテクチャ.md — renderer の構成と画面要件
- docs/フロントエンド規約.md — renderer と main の分離、データフロー
- docs/リポジトリ層設計規約.md — SQLite アクセスの規約
- docs/インフラストラクチャ規約.md — monorepo・ビルド・配布・データ保存
- docs/品質チェック・テスト規約.md — 品質チェック・verify コマンド
- docs/テストガイドライン.md — テストの書き方と配置
- docs/スタイルガイド.md — Tailwind CSS のスタイルルール
- docs/loop-engineering.md — Loop運用と安全境界
