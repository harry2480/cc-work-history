import { formatDateTime, formatDuration, formatInteger, formatTime } from '@/lib/utils/format';
import type { SessionDetailDto } from '@shared/ipc-contract';

/**
 * セッションを日報やメモに貼れる Markdown にする。
 * 例:
 * ### app（2026/10/1(木) 09:00〜10:30・1時間 25分）
 * README の誤字を直した
 * タグ: #docs #fix
 */
export function sessionToMarkdown(detail: SessionDetailDto): string {
	const startedAt = new Date(detail.startedAt);
	const endedAt = new Date(detail.endedAt);
	const sameDay = startedAt.toDateString() === endedAt.toDateString();
	const range = `${formatDateTime(startedAt)}〜${sameDay ? formatTime(endedAt) : formatDateTime(endedAt)}`;

	const lines = [
		`### ${detail.project.name}（${range}・${formatDuration(detail.activeDurationMs)}）`,
	];
	if (detail.summary) lines.push('', detail.summary);
	if (detail.tags.length > 0) {
		lines.push('', `タグ: ${detail.tags.map((tag) => hashtag(tag.name)).join(' ')}`);
	}
	lines.push(
		'',
		`- プロジェクト: ${inlineCode(detail.project.path)}`,
		`- メッセージ: ${formatInteger(detail.messageCount)} / トークン: ${formatInteger(detail.totalTokens)}`,
	);
	return `${lines.join('\n')}\n`;
}

/** 記号や空白でハッシュタグが途中で切れないよう、文字・数字・_ - / 以外を _ にする */
function hashtag(name: string): string {
	return `#${name.replace(/[^\p{L}\p{N}_\-/]+/gu, '_')}`;
}

/** 値に含まれるバッククォートより長い区切りで囲み、コードスパンが途中で閉じないようにする */
function inlineCode(value: string): string {
	const longest = Math.max(0, ...(value.match(/`+/g) ?? []).map((run) => run.length));
	const fence = '`'.repeat(longest + 1);
	return longest === 0 ? `${fence}${value}${fence}` : `${fence} ${value} ${fence}`;
}
