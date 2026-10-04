---
name: add-api-integration
description: ファイルシステム・外部プロセス（Claude CLI、git など）との連携を追加する。Gateway interface + 本番 Adapter + Stub Adapter + composition での切り替えを生成する
---

# 外部連携追加スキル

ユーザーが「〇〇の情報を取り込みたい」「〇〇コマンドと連携して」と指示したときに適用する。

対象はログ読み取り・ファイル監視・Claude CLI・git・ターミナル起動など、main プロセスから外部に触れる処理。パスは `apps/desktop/src/main/backend/` からの相対パス。
参考例は概要生成（`summary-generator.gateway.ts` / `claude-cli-summary.adapter.ts` / `stub-summary-generator.adapter.ts` / `summary-generator.composition.ts`）。

## 生成するファイル

1. **Gateway Interface**（`domain/gateways/{name}.gateway.ts`）
   - 入出力の型と interface を定義する。Node.js・Electron の型を出さない
   - 失敗の種類を戻り値の型で表す（例: `{ status: 'ok' } | { status: 'unavailable' } | { status: 'failed' }`）

2. **本番 Adapter**（`infrastructure/adapters/{provider}-{name}.adapter.ts`）
   - 例: `claude-cli-summary.adapter.ts`, `chokidar-log-watcher.adapter.ts`
   - 子プロセスの起動・タイムアウト・出力のパースの入口を担当する
   - コマンドのパスや設定は環境変数（`CC_WORK_HISTORY_*`）で上書きできるようにする

3. **Stub Adapter**（`infrastructure/adapters/stub-{name}.adapter.ts`）
   - 外部に触れず固定値を返す。コンストラクタで戻り値を差し替え可能にし、呼び出し内容を記録する

4. **composition**（`presentation/composition/{name}.composition.ts`）
   - 環境変数で本番 / Stub を切り替えるファクトリ関数を置く。`env` は引数で受け取りテストしやすくする

   ```typescript
   type Env = Record<string, string | undefined>;

   /** `CC_WORK_HISTORY_STUB_XXX=true` なら Stub、それ以外は本番 */
   export function createXxxGateway(env: Env = process.env): XxxGateway {
   	if (env.CC_WORK_HISTORY_STUB_XXX === 'true') return new StubXxxAdapter();
   	return new RealXxxAdapter({ env });
   }
   ```

5. **テスト**
   - composition の切り替え: `test/unit/main/backend/presentation/composition/{name}.composition.test.ts`
   - 本番 Adapter: `test/integration/main/backend/infrastructure/adapters/{provider}-{name}.adapter.test.ts`（偽の CLI は `test/fixtures/fake-claude/` を参考にする）
   - UseCase は Stub を注入して unit テストする

## ルール

- Gateway interface は domain 層、実装は `infrastructure/adapters/` に置く
- プロンプトの組み立て・応答のパースのうちビジネスルールに当たる部分は application 層（UseCase）の責務
- 外部コマンドが見つからない環境でも、その機能以外は動作させる
- `~/.claude/projects/` は読み取り専用。外部へのネットワーク通信を追加しない（Claude CLI 呼び出しを除く）
- パッケージが必要な場合は `pnpm --filter desktop add {package}` でインストールする（追加前にユーザーに確認する）
- 変更後に `pnpm verify` と `pnpm test:integration` を実行する
