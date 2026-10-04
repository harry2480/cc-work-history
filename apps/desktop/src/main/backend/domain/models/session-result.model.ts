import type { Result } from './result.model';

export type SessionResultError = 'NEGATIVE_COUNT' | 'INVALID_DATE';

type SessionResultKind =
	| { kind: 'commits'; commitCount: number; changedFileCount: number }
	/** 作業ディレクトリが git リポジトリでない */
	| { kind: 'no_repository' };

type SessionResultProps = SessionResultKind & {
	/** 集計したときのセッションの終了日時 */
	sessionEndedAt: Date;
	computedAt: Date;
};

/** セッションの成果（期間中の自分のコミット数・変更ファイル数） */
export class SessionResult {
	private constructor(private readonly props: SessionResultProps) {}

	static create(props: SessionResultProps): Result<SessionResult, SessionResultError> {
		if (Number.isNaN(props.sessionEndedAt.getTime()) || Number.isNaN(props.computedAt.getTime())) {
			return { success: false, error: 'INVALID_DATE' };
		}
		if (
			props.kind === 'commits' &&
			!(isCount(props.commitCount) && isCount(props.changedFileCount))
		) {
			return { success: false, error: 'NEGATIVE_COUNT' };
		}
		return { success: true, value: new SessionResult({ ...props }) };
	}

	get value(): SessionResultKind {
		const { sessionEndedAt: _e, computedAt: _c, ...value } = this.props;
		return value;
	}
	get sessionEndedAt(): Date {
		return this.props.sessionEndedAt;
	}
	get computedAt(): Date {
		return this.props.computedAt;
	}

	/** 集計したあとにセッションが更新されていなければ、保存済みの結果をそのまま使える */
	isUpToDateWith(sessionEndedAt: Date): boolean {
		return this.props.sessionEndedAt.getTime() === sessionEndedAt.getTime();
	}
}

function isCount(value: number): boolean {
	return Number.isInteger(value) && value >= 0;
}
