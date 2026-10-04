import type Database from 'better-sqlite3';
import type { IpcMain } from 'electron';
import { IPC_CHANNELS, type PingResult } from '../../../../shared/ipc-contract';
import { GetDashboardUseCase } from '../../application/usecases/get-dashboard.usecase';
import { GetFilterOptionsUseCase } from '../../application/usecases/get-filter-options.usecase';
import { GetSessionDetailUseCase } from '../../application/usecases/get-session-detail.usecase';
import { GetTimelineUseCase } from '../../application/usecases/get-timeline.usecase';
import { UpdateSessionAnnotationUseCase } from '../../application/usecases/update-session-annotation.usecase';
import { SqliteActivityStatsRepository } from '../../infrastructure/repositories/sqlite-activity-stats.repository';
import { SqliteProjectRepository } from '../../infrastructure/repositories/sqlite-project.repository';
import { SqliteSessionAnnotationRepository } from '../../infrastructure/repositories/sqlite-session-annotation.repository';
import { SqliteSessionRepository } from '../../infrastructure/repositories/sqlite-session.repository';
import { updateSessionAnnotation } from '../actions/session-annotation.action';
import { loadDashboard } from '../loaders/dashboard.loader';
import { loadFilterOptions, loadSessionDetail, loadTimeline } from '../loaders/timeline.loader';

/** renderer から呼ばれる IPC ハンドラ（loader / action）を登録する */
export function registerIpcHandlers(ipcMain: IpcMain, db: Database.Database): void {
	const sessionRepository = new SqliteSessionRepository(db);
	const annotationRepository = new SqliteSessionAnnotationRepository(db);
	const getTimeline = new GetTimelineUseCase(sessionRepository, annotationRepository);
	const getSessionDetail = new GetSessionDetailUseCase(sessionRepository, annotationRepository);
	const updateAnnotation = new UpdateSessionAnnotationUseCase(annotationRepository);
	const getFilterOptions = new GetFilterOptionsUseCase(
		new SqliteProjectRepository(db),
		annotationRepository,
	);

	ipcMain.handle(
		IPC_CHANNELS.ping,
		(): PingResult => ({ message: 'pong', electronVersion: process.versions.electron }),
	);
	ipcMain.handle(IPC_CHANNELS.getTimeline, (_event, request: unknown) =>
		loadTimeline(getTimeline, request, new Date()),
	);
	ipcMain.handle(IPC_CHANNELS.getSessionDetail, (_event, request: unknown) =>
		loadSessionDetail(getSessionDetail, request, new Date()),
	);
	const getDashboard = new GetDashboardUseCase(new SqliteActivityStatsRepository(db));
	ipcMain.handle(IPC_CHANNELS.getDashboard, (_event, request: unknown) =>
		loadDashboard(getDashboard, request),
	);
	ipcMain.handle(IPC_CHANNELS.getFilterOptions, () => loadFilterOptions(getFilterOptions));
	ipcMain.handle(IPC_CHANNELS.updateSessionAnnotation, (_event, request: unknown) =>
		updateSessionAnnotation(updateAnnotation, request),
	);
}
