import type { SessionLogFile, SessionLogGateway } from '../../domain/gateways/session-log.gateway';
import { Project } from '../../domain/models/project.model';
import { Session } from '../../domain/models/session.model';
import type { ProjectRepository } from '../../domain/repositories/project.repository';
import type { SessionLogFileRepository } from '../../domain/repositories/session-log-file.repository';
import type { SessionRepository } from '../../domain/repositories/session.repository';

export type ImportFailure = {
	path: string;
	reason: string;
};

export type ImportedSession = {
	id: string;
	startedAt: Date;
	endedAt: Date;
};

export type ImportResult = {
	/** 見つかったセッションログファイルの数 */
	scanned: number;
	/** 取り込んだ（新規・更新）セッションの数 */
	imported: number;
	/** 前回から変わっていないため読まなかったファイルの数 */
	unchanged: number;
	/** メッセージを含まないため取り込まなかったファイルの数 */
	empty: number;
	failures: ImportFailure[];
	/** 取り込んだ（新規・更新）セッション */
	importedSessions: ImportedSession[];
};

type ExecuteOptions = {
	/** 指定したプロジェクトだけを対象にする（ファイル監視からの差分取り込み用） */
	projectIds?: readonly string[];
};

type Options = {
	/** この件数ごとに main プロセスのイベントループへ制御を返す */
	batchSize?: number;
	yieldControl?: () => Promise<void>;
};

/**
 * Claude Code のセッションログを DB に取り込む。
 * 前回取り込んだときから更新日時・サイズが変わったファイルだけを読む。
 */
export class ImportSessionLogsUseCase {
	private readonly batchSize: number;
	private readonly yieldControl: () => Promise<void>;

	constructor(
		private readonly sessionLogGateway: SessionLogGateway,
		private readonly projectRepository: ProjectRepository,
		private readonly sessionRepository: SessionRepository,
		private readonly sessionLogFileRepository: SessionLogFileRepository,
		options: Options = {},
	) {
		this.batchSize = options.batchSize ?? 50;
		this.yieldControl = options.yieldControl ?? (() => new Promise((r) => setImmediate(r)));
	}

	async execute({ projectIds }: ExecuteOptions = {}): Promise<ImportResult> {
		const result: ImportResult = {
			scanned: 0,
			imported: 0,
			unchanged: 0,
			empty: 0,
			failures: [],
			importedSessions: [],
		};
		const importedFiles = this.sessionLogFileRepository.findAll();
		const targetProjectIds = projectIds ?? (await this.sessionLogGateway.listProjectIds());
		let processedInBatch = 0;

		for (const projectId of targetProjectIds) {
			for (const file of await this.sessionLogGateway.listSessionFiles(projectId)) {
				result.scanned++;
				if (this.isUnchanged(file, importedFiles.get(file.path))) {
					result.unchanged++;
					continue;
				}

				await this.importFile(file, result);

				processedInBatch++;
				if (processedInBatch >= this.batchSize) {
					processedInBatch = 0;
					await this.yieldControl();
				}
			}
		}
		return result;
	}

	private async importFile(file: SessionLogFile, result: ImportResult): Promise<void> {
		try {
			const entries = await this.sessionLogGateway.readEntries(file);
			const session = Session.fromLogEntries({
				id: file.sessionId,
				projectId: file.projectId,
				entries,
			});

			if (!session.success) {
				if (session.error === 'NO_ENTRIES') {
					result.empty++;
					this.sessionLogFileRepository.save(file);
				} else {
					result.failures.push({ path: file.path, reason: session.error });
				}
				return;
			}

			this.projectRepository.save(this.projectFor(session.value));
			this.sessionRepository.save(session.value);
			// 記録は最後に保存する。途中で失敗したら次回に再取り込みされる
			this.sessionLogFileRepository.save(file);
			result.imported++;
			result.importedSessions.push({
				id: session.value.id,
				startedAt: session.value.startedAt,
				endedAt: session.value.endedAt,
			});
		} catch (error) {
			result.failures.push({ path: file.path, reason: String(error) });
		}
	}

	private projectFor(session: Session): Project {
		const existing = this.projectRepository.findById(session.projectId);
		if (existing) return existing.touch(session.endedAt);

		// 作業ディレクトリが取れないセッションはディレクトリ名をパスの代わりにする
		const created = Project.create({
			id: session.projectId,
			path: session.cwd ?? session.projectId,
			lastActivityAt: session.endedAt,
		});
		if (!created.success) throw new Error(`プロジェクトを作成できません: ${created.error}`);
		return created.value;
	}

	private isUnchanged(file: SessionLogFile, imported: SessionLogFile | undefined): boolean {
		return (
			imported !== undefined &&
			imported.modifiedAt.getTime() === file.modifiedAt.getTime() &&
			imported.sizeBytes === file.sizeBytes
		);
	}
}
