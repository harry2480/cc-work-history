import type Database from 'better-sqlite3';

export type Migration = {
	version: number;
	name: string;
	sql: string;
};

const FILE_NAME_PATTERN = /^(\d{4})_[a-z0-9_]+\.sql$/;

/**
 * `PRAGMA user_version` を適用済みバージョンとして使い、未適用のマイグレーションを順に適用する。
 * 1 マイグレーション = 1 トランザクション。失敗したらそのマイグレーションは丸ごと巻き戻る。
 */
export class SqliteMigrator {
	private readonly migrations: readonly Migration[];

	constructor(migrations: readonly Migration[]) {
		this.migrations = SqliteMigrator.validate(migrations);
	}

	/** `import.meta.glob` で読み込んだ `{ パス: SQL }` から生成する */
	static fromFiles(files: Record<string, string>): SqliteMigrator {
		const migrations = Object.entries(files).map(([path, sql]) => {
			const name = path.split('/').pop() ?? path;
			const match = FILE_NAME_PATTERN.exec(name);
			if (!match) {
				throw new Error(`マイグレーションのファイル名が不正です: ${name}`);
			}
			return { version: Number(match[1]), name, sql };
		});
		return new SqliteMigrator(migrations);
	}

	get latestVersion(): number {
		return this.migrations.at(-1)?.version ?? 0;
	}

	/** 未適用のマイグレーションを適用し、適用したバージョンを返す */
	migrate(db: Database.Database): number[] {
		const current = db.pragma('user_version', { simple: true }) as number;
		if (current > this.latestVersion) {
			throw new Error(
				`DB のスキーマ（v${current}）がアプリの想定（v${this.latestVersion}）より新しいため開けません`,
			);
		}

		const pending = this.migrations.filter((m) => m.version > current);
		for (const migration of pending) {
			db.transaction(() => {
				db.exec(migration.sql);
				db.pragma(`user_version = ${migration.version}`);
			})();
		}
		return pending.map((m) => m.version);
	}

	private static validate(migrations: readonly Migration[]): Migration[] {
		const sorted = [...migrations].sort((a, b) => a.version - b.version);
		sorted.forEach((migration, index) => {
			if (migration.version !== index + 1) {
				throw new Error(
					`マイグレーションの連番が 1 から連続していません: ${sorted.map((m) => m.version).join(', ')}`,
				);
			}
		});
		return sorted;
	}
}
