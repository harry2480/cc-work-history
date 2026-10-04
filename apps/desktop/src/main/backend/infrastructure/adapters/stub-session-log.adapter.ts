import type {
	ConversationMessage,
	SessionLogFile,
	SessionLogGateway,
} from '../../domain/gateways/session-log.gateway';
import type { SessionLogEntry } from '../../domain/models/session-log-entry.model';

export type StubSession = {
	projectId: string;
	sessionId: string;
	entries: SessionLogEntry[];
	conversation?: ConversationMessage[];
	modifiedAt?: Date;
};

/** テスト・開発用。ファイルシステムを読まず、渡されたセッションを返す */
export class StubSessionLogAdapter implements SessionLogGateway {
	constructor(private readonly sessions: readonly StubSession[] = []) {}

	async listProjectIds(): Promise<string[]> {
		return [...new Set(this.sessions.map((s) => s.projectId))].sort();
	}

	async listSessionFiles(projectId: string): Promise<SessionLogFile[]> {
		return this.sessions
			.filter((s) => s.projectId === projectId)
			.map((s) => ({
				projectId: s.projectId,
				sessionId: s.sessionId,
				path: `stub://${s.projectId}/${s.sessionId}.jsonl`,
				modifiedAt: s.modifiedAt ?? new Date(0),
				sizeBytes: s.entries.length,
			}));
	}

	async readEntries(file: SessionLogFile): Promise<SessionLogEntry[]> {
		return [...(this.find(file)?.entries ?? [])];
	}

	async readConversation(file: SessionLogFile): Promise<ConversationMessage[] | null> {
		const session = this.find(file);
		return session ? [...(session.conversation ?? [])] : null;
	}

	private find(file: SessionLogFile): StubSession | undefined {
		return this.sessions.find(
			(s) => s.projectId === file.projectId && s.sessionId === file.sessionId,
		);
	}
}
