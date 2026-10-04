import type { GitGateway } from '../../domain/gateways/git.gateway';
import { SessionResult } from '../../domain/models/session-result.model';
import { DEFAULT_IDLE_THRESHOLD_MS } from '../../domain/models/session.model';
import type { SessionResultRepository } from '../../domain/repositories/session-result.repository';
import type { SessionRepository } from '../../domain/repositories/session.repository';

export type SessionResultView =
	| { status: 'commits'; commitCount: number; changedFileCount: number; computedAt: Date }
	/** 作業ディレクトリが git リポジトリでない */
	| { status: 'no_repository' }
	/** git が使えないなどで集計できなかった（保存せず、次に開いたときにもう一度試す） */
	| { status: 'unavailable'; reason: string };

/**
 * セッションの成果（期間中の自分のコミット数・変更ファイル数）を取得する。
 * 完了したセッションは保存済みの集計を使い、進行中または集計後に更新されたセッションは git から集計し直して保存する。
 * セッションが見つからなければ null
 */
export class GetSessionResultUseCase {
	/** 同じセッションの集計が実行中なら、終わるのを待ってその結果を使う（git を重ねて実行しない） */
	private readonly running = new Map<string, Promise<SessionResultView | null>>();

	constructor(
		private readonly sessionRepository: SessionRepository,
		private readonly sessionResultRepository: SessionResultRepository,
		private readonly gitGateway: GitGateway,
		private readonly idleThresholdMs: () => number = () => DEFAULT_IDLE_THRESHOLD_MS,
	) {}

	execute(sessionId: string, now: Date): Promise<SessionResultView | null> {
		const running = this.running.get(sessionId);
		if (running) return running;
		const task = this.compute(sessionId, now).finally(() => this.running.delete(sessionId));
		this.running.set(sessionId, task);
		return task;
	}

	private async compute(sessionId: string, now: Date): Promise<SessionResultView | null> {
		const found = this.sessionRepository.findById(sessionId);
		if (!found) return null;
		const { session, project } = found;

		const saved = this.sessionResultRepository.findBySessionId(sessionId);
		const completed = session.status(now, this.idleThresholdMs()) === 'completed';
		if (saved && completed && saved.isUpToDateWith(session.endedAt)) return toView(saved);

		const stats = await this.gitGateway.commitStats({
			cwd: session.cwd ?? project.path,
			since: session.startedAt,
			until: session.endedAt,
		});
		if (stats.status === 'unavailable' || stats.status === 'failed') {
			return { status: 'unavailable', reason: stats.reason };
		}

		const created = SessionResult.create({
			...(stats.status === 'ok'
				? { kind: 'commits' as const, ...stats.value }
				: { kind: 'no_repository' as const }),
			sessionEndedAt: session.endedAt,
			computedAt: now,
		});
		if (!created.success) return { status: 'unavailable', reason: '集計結果が不正です' };
		this.sessionResultRepository.save(sessionId, created.value);
		return toView(created.value);
	}
}

function toView(result: SessionResult): SessionResultView {
	const value = result.value;
	if (value.kind === 'no_repository') return { status: 'no_repository' };
	return {
		status: 'commits',
		commitCount: value.commitCount,
		changedFileCount: value.changedFileCount,
		computedAt: result.computedAt,
	};
}
