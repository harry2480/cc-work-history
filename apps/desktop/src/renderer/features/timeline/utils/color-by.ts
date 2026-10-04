import { NEUTRAL_COLOR, STATUS_COLORS, paletteColor } from '@/lib/config/palette';
import type { ColorBy } from '@/stores/display-settings-store';
import type { TimelineSessionDto } from '@shared/ipc-contract';

export type ColorGroup = {
	/** 凡例でまとめる単位 */
	key: string;
	label: string;
	color: string;
};

const STATUS_LABELS = { active: '進行中', completed: '完了' } as const;

/**
 * セッションの色を、色分けの基準に応じて決める。
 * 複数のタグを持つセッションは最初のタグ（手動で付けたもの → 自動生成の順）の色にする
 */
export function colorGroupOf(session: TimelineSessionDto, colorBy: ColorBy): ColorGroup {
	switch (colorBy) {
		case 'project':
			return {
				key: `project:${session.project.id}`,
				label: session.project.name,
				color: paletteColor(session.project.id),
			};
		case 'tag': {
			const tag = session.tags[0];
			return tag
				? {
						key: `tag:${tag.toLowerCase()}`,
						label: `#${tag}`,
						color: paletteColor(tag.toLowerCase()),
					}
				: { key: 'tag:none', label: 'タグなし', color: NEUTRAL_COLOR };
		}
		case 'status':
			return {
				key: `status:${session.status}`,
				label: STATUS_LABELS[session.status],
				color: STATUS_COLORS[session.status],
			};
	}
}

/** 凡例に出す色のグループ（重複なし・ラベル順。「タグなし」は最後） */
export function legendOf(sessions: readonly TimelineSessionDto[], colorBy: ColorBy): ColorGroup[] {
	const groups = new Map<string, ColorGroup>();
	for (const session of sessions) {
		const group = colorGroupOf(session, colorBy);
		groups.set(group.key, group);
	}
	return [...groups.values()].sort((a, b) => {
		if (a.key === 'tag:none') return 1;
		if (b.key === 'tag:none') return -1;
		return a.label.localeCompare(b.label, 'ja');
	});
}
