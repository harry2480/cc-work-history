import type Database from 'better-sqlite3';
import type { IpcMain } from 'electron';
import { IPC_CHANNELS, type PingResult } from '../../../../shared/ipc-contract';
import { GenerateSessionSummaryUseCase } from '../../application/usecases/generate-session-summary.usecase';
import { GetAppSettingsUseCase } from '../../application/usecases/get-app-settings.usecase';
import { GetDashboardUseCase } from '../../application/usecases/get-dashboard.usecase';
import { GetFilterOptionsUseCase } from '../../application/usecases/get-filter-options.usecase';
import { GetSessionConversationUseCase } from '../../application/usecases/get-session-conversation.usecase';
import { GetSessionDetailUseCase } from '../../application/usecases/get-session-detail.usecase';
import { GetSessionResultUseCase } from '../../application/usecases/get-session-result.usecase';
import { GetTimelineUseCase } from '../../application/usecases/get-timeline.usecase';
import type { ImportResult } from '../../application/usecases/import-session-logs.usecase';
import { ListSessionsUseCase } from '../../application/usecases/list-sessions.usecase';
import { ResumeSessionUseCase } from '../../application/usecases/resume-session.usecase';
import { UpdateIdleThresholdUseCase } from '../../application/usecases/update-idle-threshold.usecase';
import { UpdateSessionAnnotationUseCase } from '../../application/usecases/update-session-annotation.usecase';
import { SqliteActivityStatsRepository } from '../../infrastructure/repositories/sqlite-activity-stats.repository';
import { SqliteAppSettingsRepository } from '../../infrastructure/repositories/sqlite-app-settings.repository';
import { SqliteProjectRepository } from '../../infrastructure/repositories/sqlite-project.repository';
import { SqliteSessionAnnotationRepository } from '../../infrastructure/repositories/sqlite-session-annotation.repository';
import { SqliteSessionResultRepository } from '../../infrastructure/repositories/sqlite-session-result.repository';
import { SqliteSessionRepository } from '../../infrastructure/repositories/sqlite-session.repository';
import { updateSessionAnnotation } from '../actions/session-annotation.action';
import { resumeSession } from '../actions/session-resume.action';
import { generateSessionSummary } from '../actions/session-summary.action';
import { updateIdleThreshold } from '../actions/settings.action';
import { loadDashboard } from '../loaders/dashboard.loader';
import { loadSessionConversation } from '../loaders/session-conversation.loader';
import { loadSessionList } from '../loaders/session-list.loader';
import { loadSessionResult } from '../loaders/session-result.loader';
import { type DataPaths, loadSettings } from '../loaders/settings.loader';
import { loadFilterOptions, loadSessionDetail, loadTimeline } from '../loaders/timeline.loader';
import { createGitGateway } from './git.composition';
import { createSessionLogGateway } from './session-log.composition';
import { createSummaryGenerator } from './summary-generator.composition';
import { createTerminalLauncher } from './terminal-launcher.composition';

type Options = {
	/** IPC の呼び出し元の URL がアプリ自身の画面か。違えば処理しない */
	isTrustedSender: (url: string) => boolean;
	paths: DataPaths;
	/** すべてのプロジェクトを現在の設定で取り込む（ファイル監視と同じ順番待ちで実行する） */
	importAll: () => Promise<ImportResult>;
};

/** renderer から呼ばれる IPC ハンドラ（loader / action）を登録する */
export function registerIpcHandlers(
	ipcMainToWrap: IpcMain,
	db: Database.Database,
	{ isTrustedSender, paths, importAll }: Options,
): void {
	const ipcMain = withSenderCheck(ipcMainToWrap, isTrustedSender);
	const sessionRepository = new SqliteSessionRepository(db);
	const annotationRepository = new SqliteSessionAnnotationRepository(db);
	const appSettingsRepository = new SqliteAppSettingsRepository(db);
	const idleThresholdMs = () => appSettingsRepository.get().idleThresholdMs;
	const getTimeline = new GetTimelineUseCase(
		sessionRepository,
		annotationRepository,
		idleThresholdMs,
	);
	const getSessionDetail = new GetSessionDetailUseCase(
		sessionRepository,
		annotationRepository,
		idleThresholdMs,
	);
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
	const listSessions = new ListSessionsUseCase(
		sessionRepository,
		annotationRepository,
		idleThresholdMs,
	);
	ipcMain.handle(IPC_CHANNELS.listSessions, (_event, request: unknown) =>
		loadSessionList(listSessions, request, new Date()),
	);
	const getDashboard = new GetDashboardUseCase(new SqliteActivityStatsRepository(db));
	ipcMain.handle(IPC_CHANNELS.getDashboard, (_event, request: unknown) =>
		loadDashboard(getDashboard, request),
	);
	ipcMain.handle(IPC_CHANNELS.getFilterOptions, () => loadFilterOptions(getFilterOptions));
	ipcMain.handle(IPC_CHANNELS.updateSessionAnnotation, (_event, request: unknown) =>
		updateSessionAnnotation(updateAnnotation, request),
	);
	const getAppSettings = new GetAppSettingsUseCase(appSettingsRepository);
	ipcMain.handle(IPC_CHANNELS.getSettings, () => loadSettings(getAppSettings, paths));
	const updateIdleThresholdUseCase = new UpdateIdleThresholdUseCase(appSettingsRepository, {
		importAll,
	});
	ipcMain.handle(IPC_CHANNELS.updateIdleThreshold, (_event, request: unknown) =>
		updateIdleThreshold(updateIdleThresholdUseCase, request),
	);
	const resumeSessionUseCase = new ResumeSessionUseCase(
		sessionRepository,
		createTerminalLauncher(),
	);
	ipcMain.handle(IPC_CHANNELS.resumeSession, (_event, request: unknown) =>
		resumeSession(resumeSessionUseCase, request),
	);
	const getSessionResult = new GetSessionResultUseCase(
		sessionRepository,
		new SqliteSessionResultRepository(db),
		createGitGateway(),
		idleThresholdMs,
	);
	ipcMain.handle(IPC_CHANNELS.getSessionResult, (_event, request: unknown) =>
		loadSessionResult(getSessionResult, request, new Date()),
	);
	const sessionLogGateway = createSessionLogGateway();
	const generateSummary = new GenerateSessionSummaryUseCase(
		sessionRepository,
		annotationRepository,
		sessionLogGateway,
		createSummaryGenerator(),
	);
	ipcMain.handle(IPC_CHANNELS.generateSessionSummary, (_event, request: unknown) =>
		generateSessionSummary(generateSummary, request),
	);
	const getSessionConversation = new GetSessionConversationUseCase(
		sessionRepository,
		sessionLogGateway,
	);
	ipcMain.handle(IPC_CHANNELS.getSessionConversation, (_event, request: unknown) =>
		loadSessionConversation(getSessionConversation, request),
	);
}

/** アプリ自身の画面以外（外部のページや iframe）からの呼び出しを断る ipcMain.handle */
function withSenderCheck(
	ipcMain: IpcMain,
	isTrustedSender: (url: string) => boolean,
): Pick<IpcMain, 'handle'> {
	return {
		handle: (channel, listener) =>
			ipcMain.handle(channel, (event, ...args) => {
				const url = event.senderFrame?.url ?? '';
				if (!isTrustedSender(url)) {
					throw new Error(`許可されていない呼び出し元です: ${channel}`);
				}
				return listener(event, ...args);
			}),
	};
}
