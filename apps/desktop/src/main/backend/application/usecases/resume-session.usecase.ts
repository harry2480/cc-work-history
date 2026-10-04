import type {
	TerminalLaunchResult,
	TerminalLauncherGateway,
} from '../../domain/gateways/terminal-launcher.gateway';
import type { SessionRepository } from '../../domain/repositories/session.repository';

/** 再開するセッションが見つからないときのエラー */
export class SessionNotFoundError extends Error {
	override name = 'SessionNotFoundError';
}

/**
 * ターミナルを開き、セッションを始めた作業ディレクトリで `claude -r` を実行して再開する。
 * 作業ディレクトリがログにないセッションはプロジェクトのパスを使う
 */
export class ResumeSessionUseCase {
	constructor(
		private readonly sessionRepository: SessionRepository,
		private readonly terminalLauncher: TerminalLauncherGateway,
	) {}

	async execute(sessionId: string): Promise<TerminalLaunchResult> {
		const found = this.sessionRepository.findById(sessionId);
		if (!found) throw new SessionNotFoundError(`セッションが見つかりません: ${sessionId}`);
		return this.terminalLauncher.resume({
			cwd: found.session.cwd ?? found.project.path,
			sessionId: found.session.id,
		});
	}
}
