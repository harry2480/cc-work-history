import type { Result } from './result.model';

export type ActivityError = 'EMPTY_SESSION_ID' | 'ENDED_BEFORE_STARTED' | 'NO_MESSAGES';

type ActivityProps = {
	sessionId: string;
	startedAt: Date;
	endedAt: Date;
	messageCount: number;
};

/** タイムラインに 1 本のバーとして表示する活動区間 */
export class Activity {
	private constructor(
		readonly sessionId: string,
		readonly startedAt: Date,
		readonly endedAt: Date,
		readonly messageCount: number,
	) {}

	static create(props: ActivityProps): Result<Activity, ActivityError> {
		if (!props.sessionId.trim()) return { success: false, error: 'EMPTY_SESSION_ID' };
		if (props.endedAt < props.startedAt) return { success: false, error: 'ENDED_BEFORE_STARTED' };
		if (props.messageCount < 1) return { success: false, error: 'NO_MESSAGES' };
		return {
			success: true,
			value: new Activity(props.sessionId, props.startedAt, props.endedAt, props.messageCount),
		};
	}

	get durationMs(): number {
		return this.endedAt.getTime() - this.startedAt.getTime();
	}
}
