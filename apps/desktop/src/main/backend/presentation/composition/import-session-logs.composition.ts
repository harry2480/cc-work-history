import type Database from 'better-sqlite3';
import { ImportSessionLogsUseCase } from '../../application/usecases/import-session-logs.usecase';
import { SqliteProjectRepository } from '../../infrastructure/repositories/sqlite-project.repository';
import { SqliteSessionLogFileRepository } from '../../infrastructure/repositories/sqlite-session-log-file.repository';
import { SqliteSessionRepository } from '../../infrastructure/repositories/sqlite-session.repository';
import { createSessionLogGateway } from './session-log.composition';

type Env = Record<string, string | undefined>;

export function createImportSessionLogsUseCase(
	db: Database.Database,
	env: Env = process.env,
): ImportSessionLogsUseCase {
	return new ImportSessionLogsUseCase(
		createSessionLogGateway(env),
		new SqliteProjectRepository(db),
		new SqliteSessionRepository(db),
		new SqliteSessionLogFileRepository(db),
	);
}
