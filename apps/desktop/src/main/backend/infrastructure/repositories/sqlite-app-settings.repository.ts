import type Database from 'better-sqlite3';
import { AppSettings } from '../../domain/models/app-settings.model';
import type { AppSettingsRepository } from '../../domain/repositories/app-settings.repository';

const IDLE_THRESHOLD_KEY = 'idle_threshold_minutes';

export class SqliteAppSettingsRepository implements AppSettingsRepository {
	constructor(private readonly db: Database.Database) {}

	get(): AppSettings {
		const row = this.db
			.prepare<[string], { value: string }>('SELECT value FROM app_settings WHERE key = ?')
			.get(IDLE_THRESHOLD_KEY);
		if (!row) return AppSettings.default();

		const settings = AppSettings.create({ idleThresholdMinutes: parseJson(row.value) as number });
		return settings.success ? settings.value : AppSettings.default();
	}

	save(settings: AppSettings): void {
		this.db
			.prepare<[string, string]>(
				`INSERT INTO app_settings (key, value) VALUES (?, ?)
				ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
			)
			.run(IDLE_THRESHOLD_KEY, JSON.stringify(settings.idleThresholdMinutes));
	}
}

function parseJson(value: string): unknown {
	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
}
