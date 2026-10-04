---
name: db-table
description: SQLite にテーブル・カラムを追加・変更する。連番のマイグレーション SQL + Repository interface + better-sqlite3 の Repository 実装 + Integration テストを生成する
---

# DB テーブル追加・変更スキル

ユーザーが「〇〇テーブルを追加して」「〇〇カラムを追加して」と指示したときに適用する。

DB は main プロセスの SQLite（better-sqlite3）。パスは `apps/desktop/src/main/backend/` からの相対パス。
規約の詳細は `docs/リポジトリ層設計規約.md`。参考例は `0004_create_session_annotations.sql` と `sqlite-session-annotation.repository.ts`。

## 手順

### 1. マイグレーション SQL を追加する

`infrastructure/db/migrations/<4 桁の連番>_<説明>.sql` を新規作成する。

- 番号は既存の最大値 + 1（例: 最大が `0005_...` なら次は `0006_add_xxx.sql`）。1 から連続していないと起動時にエラーになる
- 説明は小文字英数字とアンダースコアのみ（`^\d{4}_[a-z0-9_]+\.sql$`）
- **適用済みのマイグレーションは編集しない。** 変更は必ず新しいファイルで行う
- テーブル名は snake_case 複数形、カラム名は snake_case
- 日時は UTC のエポックミリ秒の `INTEGER`（`Date#getTime()` で保存し、`new Date(row.xxx_at)` で復元）、真偽値は `INTEGER NOT NULL DEFAULT 0`、外部キーは `REFERENCES ... ON DELETE CASCADE`
- 絞り込みに使うカラムにはインデックスを張る
- 先頭にテーブルの用途をコメントで書く

`infrastructure/db/migrations.ts` が `import.meta.glob` でディレクトリ内の SQL を取り込み、`SqliteMigrator` が起動時に `PRAGMA user_version` を見て未適用分を 1 ファイル 1 トランザクションで適用する。登録作業は不要。

### 2. Domain Model を用意する

`domain/models/{name}.model.ts`（既存モデルにカラムを足すだけなら更新のみ）:

- Rich Domain Model（`private constructor` + 生成・検証用のファクトリ + 保存値から復元する `restore()`）
- バリデーションはモデル自身で行い、`Result<T, E>` で返す

### 3. Repository Interface を追加する

`domain/repositories/{name}.repository.ts`:

- ドメインモデル型だけを使う。行型・SQL・`Database` を出さない
- メソッドは同期（better-sqlite3 は同期 API）

### 4. Repository 実装を追加する

`infrastructure/repositories/sqlite-{name}.repository.ts`:

```typescript
import type Database from 'better-sqlite3';

type XxxRow = { id: string; created_at: number };

export class SqliteXxxRepository implements XxxRepository {
	constructor(private readonly db: Database.Database) {}

	findById(id: string): Xxx | null {
		const row = this.db.prepare<[string], XxxRow>('SELECT * FROM xxxs WHERE id = ?').get(id);
		return row ? this.toModel(row) : null;
	}

	private toModel(row: XxxRow): Xxx {
		// 行 → ドメインモデルの変換はここに閉じる
	}
}
```

- SQL はプレースホルダ付きのプリペアドステートメントで書く（文字列連結禁止）。ID の配列は `json_each(?)` に JSON 文字列で渡す
- 複数テーブルへの書き込みは `this.db.transaction(() => { ... })()` でまとめる
- snake_case の行型を Repository の外に出さない
- `new Database()` やマイグレーションを Repository から呼ばない（`infrastructure/db/` と composition の責務）

### 5. composition で注入する

`presentation/composition/ipc-handlers.composition.ts`（または該当する composition）で `new SqliteXxxRepository(db)` を生成し、UseCase に渡す。

### 6. Integration テストを追加する

`apps/desktop/test/integration/main/backend/infrastructure/repositories/sqlite-{name}.repository.test.ts`:

- `beforeEach` で `mkdtempSync(join(tmpdir(), 'cc-work-history-test-'))` に `openSqliteDatabase()` で DB を作り、`SqliteMigrator.fromFiles(migrationFiles).migrate(db)` を適用する
- `afterEach` で `db.close()` と `rmSync(dir, { recursive: true, force: true })`
- 戻り値だけでなく DB の状態（件数・行の内容）も検証する
- 期間の端・NULL（進行中セッションなど）の境界値を含める

## ルール

- Repository はクラスで実装し、domain の interface を `implements` する
- 複雑なビジネスロジックは UseCase / Domain Model に残す（SQL で集計した方が明らかに速いものは例外）
- 実際のセッションログをフィクスチャとしてコミットしない
- 変更後に `pnpm verify` と `pnpm test:integration` を実行する（integration は verify に含まれない）
