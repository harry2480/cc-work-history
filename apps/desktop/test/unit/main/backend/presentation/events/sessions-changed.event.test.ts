import type { WebContents } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { createSessionsChangedPublisher } from '../../../../../../src/main/backend/presentation/events/sessions-changed.event';
import { IPC_CHANNELS } from '../../../../../../src/shared/ipc-contract';

function target(destroyed = false) {
	return { send: vi.fn(), isDestroyed: () => destroyed } as unknown as WebContents & {
		send: ReturnType<typeof vi.fn>;
	};
}

describe('createSessionsChangedPublisher', () => {
	it('閉じていないウィンドウに、日時を ISO 文字列にして送る', () => {
		const open = target();
		const closed = target(true);
		const publish = createSessionsChangedPublisher(() => [open, closed]);

		publish({
			sessionIds: ['s1'],
			from: new Date('2026-10-01T09:00:00Z'),
			to: new Date('2026-10-01T10:00:00Z'),
		});

		expect(open.send).toHaveBeenCalledWith(IPC_CHANNELS.sessionsChanged, {
			sessionIds: ['s1'],
			from: '2026-10-01T09:00:00.000Z',
			to: '2026-10-01T10:00:00.000Z',
		});
		expect(closed.send).not.toHaveBeenCalled();
	});
});
