---
name: add-feature
description: 新しい機能を追加する。ユーザーが機能の説明をしたとき、main（DDD 4層）・IPC 契約・preload・renderer の各ファイルを生成する
---

# 機能追加スキル

ユーザーが「〇〇な機能を作って」と指示したときに適用する。
Electron の main / preload / renderer / shared にまたがって、以下の順で実装する。

パスはすべて `apps/desktop/` からの相対パス。main のバックエンドは `src/main/backend/`（以下 `backend/`）。

## 参考にする既存機能

セッションの概要・タグ編集機能が全レイヤーそろった最新の例。迷ったらこれに合わせる。

| 種類 | ファイル |
|---|---|
| IPC 契約 | `src/shared/ipc-contract.ts`（`updateSessionAnnotation`） |
| Domain Model | `backend/domain/models/session-annotation.model.ts` |
| Repository Interface | `backend/domain/repositories/session-annotation.repository.ts` |
| UseCase | `backend/application/usecases/update-session-annotation.usecase.ts` |
| マイグレーション | `backend/infrastructure/db/migrations/0004_create_session_annotations.sql` |
| Repository 実装 | `backend/infrastructure/repositories/sqlite-session-annotation.repository.ts` |
| Action | `backend/presentation/actions/session-annotation.action.ts` |
| 登録 | `backend/presentation/composition/ipc-handlers.composition.ts` |
| renderer | `src/renderer/features/session-detail/components/annotation-section.tsx` |

## 手順

### 1. IPC 契約を定義する（`src/shared/ipc-contract.ts`）

- `IPC_CHANNELS` にチャンネルを追加する（`'<対象>:<操作>'` 形式。例: `'sessions:update-annotation'`）
- リクエスト / レスポンスの DTO 型を追加する。日時は ISO 8601 文字列、ドメインモデルは渡さない
- `DesktopApi` にメソッドを追加する
- 型と定数以外は置かない

### 2. domain 層

1. **Domain Model**（`backend/domain/models/{name}.model.ts`）
   - Rich Domain Model。`private constructor` + ファクトリメソッド（生成・検証用と、保存値からの `restore()` など）
   - 不変条件はファクトリで強制し、エラーは `Result<T, E>`（`result.model.ts`）で返す
   - Electron・Node.js API を import しない
2. **Repository Interface**（`backend/domain/repositories/{name}.repository.ts`）— DB を使う場合
   - ドメインモデル型だけを使う（行型・SQL を出さない）
3. **Gateway Interface**（`backend/domain/gateways/{name}.gateway.ts`）— ファイル・外部プロセスに触れる場合（`add-api-integration` スキル参照）

### 3. application 層（`backend/application/usecases/{action}-{name}.usecase.ts`）

- クラス + コンストラクタ DI（`private readonly` で Repository / Gateway の interface を受け取る）
- `execute()` で公開。domain の `Result` が失敗なら意味のあるエラーを throw する
- infrastructure を import しない

### 4. infrastructure 層

- DB を使う場合: マイグレーション SQL と `Sqlite{Name}Repository` を追加する（`db-table` スキル参照）
- Gateway を使う場合: 本番 Adapter と Stub Adapter を追加する（`add-api-integration` スキル参照）

### 5. presentation 層

- **読み取り**は `backend/presentation/loaders/{name}.loader.ts`、**副作用**は `backend/presentation/actions/{name}.action.ts`
  - UseCase と `request: unknown` を受け取る関数としてエクスポートする（既存の loader / action と同じ形）
  - 入口で引数を検証し、不正なら `InvalidIpcRequestError`（`loaders/timeline.loader.ts`）を throw する
  - UseCase の結果を DTO に変換する（`Date` → `toISOString()`）
  - domain・infrastructure を直接 import しない
- **登録**は `backend/presentation/composition/ipc-handlers.composition.ts` の `registerIpcHandlers()` で行う
  - Repository / Adapter を生成して UseCase に注入し、`ipcMain.handle(IPC_CHANNELS.xxx, ...)` で loader / action を呼ぶ
- main → renderer の通知が必要なら `backend/presentation/events/{name}.event.ts`（`sessions-changed.event.ts` 参照）

### 6. preload（`src/preload/index.ts`）

- `api` オブジェクトに `ipcRenderer.invoke(IPC_CHANNELS.xxx, request)` を呼ぶだけのメソッドを追加する。ロジックは書かない

### 7. renderer（`src/renderer/`）

- `features/{feature}/api/use-{name}.ts` で `window.api.xxx` をラップしたフックを作る
- 表示は `features/{feature}/components/`、純粋な計算は `features/{feature}/utils/` に切り出す
- 新しい画面が必要なら `add-page` スキル、UI 作成は `design-ui` スキルに従う

### 8. テスト（ソース構造をミラー）

| 対象 | 配置 |
|---|---|
| Domain Model | `test/unit/main/backend/domain/models/{name}.model.test.ts` |
| UseCase（Repository / Gateway はインメモリ実装やモックで差し替え） | `test/unit/main/backend/application/usecases/{action}-{name}.usecase.test.ts` |
| Repository・loader / action（一時ディレクトリの SQLite） | `test/integration/main/backend/...` |
| renderer の utils・コンポーネント（`window.api` をモック） | `test/unit/renderer/features/{feature}/...` |

## ルール

- ファイル命名は kebab-case + レイヤーサフィックス。`index.ts` バレルエクスポート禁止
- 依存方向: `presentation → application → domain ← infrastructure`。composition だけが全層を参照できる
- サービス（UseCase, Domain Service）はクラスベース。関数エクスポートで実装しない
- renderer は main のコードを import しない（`src/shared/` と `window.api` のみ）
- `~/.claude/projects/` のログは読み取り専用。外部へのネットワーク通信を追加しない
- 生成後に `pnpm verify` を実行して全パスすることを確認する（Repository を追加したら `pnpm test:integration` も）
