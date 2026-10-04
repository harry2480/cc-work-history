/**
 * main ↔ renderer 間の IPC チャンネルと型の唯一の定義元。
 * renderer の `window.api` の型もここから導出する。
 */

export const IPC_CHANNELS = {
	ping: 'app:ping',
	/** renderer → main: 期間（週）のタイムラインを取得する */
	getTimeline: 'timeline:get',
	/** renderer → main: セッションの詳細を取得する */
	getSessionDetail: 'sessions:get-detail',
	/** main → renderer: 取り込みでセッションが追加・更新された */
	sessionsChanged: 'sessions:changed',
} as const;

/** 疎通確認用。main が応答できることと、実行中の Electron のバージョンを返す */
export type PingResult = {
	message: string;
	electronVersion: string;
};

/** IPC で受け渡す日時はすべて ISO 8601 文字列 */
type IsoDateString = string;

export type SessionStatusDto = 'active' | 'completed';

export type ProjectSummaryDto = {
	id: string;
	name: string;
	path: string;
};

export type ActivityDto = {
	startedAt: IsoDateString;
	endedAt: IsoDateString;
	messageCount: number;
};

/** 期間の指定。`from` 以上 `to` 未満。最大 31 日 */
export type GetTimelineRequest = {
	from: IsoDateString;
	to: IsoDateString;
};

export type TimelineSessionDto = {
	id: string;
	project: ProjectSummaryDto;
	startedAt: IsoDateString;
	endedAt: IsoDateString;
	status: SessionStatusDto;
	totalTokens: number;
	messageCount: number;
	/** 期間に重なる活動区間だけ */
	activities: ActivityDto[];
};

export type TimelineDto = {
	from: IsoDateString;
	to: IsoDateString;
	sessions: TimelineSessionDto[];
};

export type GetSessionDetailRequest = {
	id: string;
};

export type SessionDetailDto = {
	id: string;
	project: ProjectSummaryDto;
	cwd: string | null;
	startedAt: IsoDateString;
	endedAt: IsoDateString;
	/** 活動区間の合計（放置時間を含まない） */
	activeDurationMs: number;
	status: SessionStatusDto;
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
	messageCount: number;
	models: string[];
	activities: ActivityDto[];
};

/** セッションの追加・更新の通知 */
export type SessionsChangedPayload = {
	sessionIds: string[];
	/** 変わったセッションが含まれる期間 */
	from: string;
	to: string;
};

/** preload が `window.api` として renderer に公開する API */
export type DesktopApi = {
	ping(): Promise<PingResult>;
	getTimeline(request: GetTimelineRequest): Promise<TimelineDto>;
	/** 見つからなければ null */
	getSessionDetail(request: GetSessionDetailRequest): Promise<SessionDetailDto | null>;
	/** セッションの変更を購読する。戻り値の関数で購読を解除する */
	onSessionsChanged(listener: (payload: SessionsChangedPayload) => void): () => void;
};
