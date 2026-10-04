import { DAY_MS } from '@/lib/utils/week';

export type BarSegment = {
	/** 何日目か（0 = 月曜） */
	dayIndex: number;
	/** その日の中での位置（0〜100 の %） */
	leftPercent: number;
	widthPercent: number;
};

/** 長さ 0 や数秒の区間も見えるようにする最小幅（%）。1 日 = 100% なので約 7 分 */
export const MIN_BAR_WIDTH_PERCENT = 0.5;

/**
 * 活動区間を、週の各日の行に置くバーに分割する。日付をまたぐ区間は日ごとに分ける。
 * days は週の各日の 0:00（ローカル時刻）。週の外にはみ出した部分は切り取る
 */
export function toBarSegments(
	activity: { startedAt: Date; endedAt: Date },
	days: readonly Date[],
): BarSegment[] {
	const segments: BarSegment[] = [];
	days.forEach((dayStart, dayIndex) => {
		const dayEnd = days[dayIndex + 1] ?? new Date(dayStart.getTime() + DAY_MS);
		const dayLength = dayEnd.getTime() - dayStart.getTime();
		const start = Math.max(activity.startedAt.getTime(), dayStart.getTime());
		const end = Math.min(activity.endedAt.getTime(), dayEnd.getTime());
		// 長さ 0 の区間はその瞬間を含む日にだけ置く
		const isInDay = start < end || (start === end && start < dayEnd.getTime());
		if (!isInDay) return;

		const widthPercent = Math.max(((end - start) / dayLength) * 100, MIN_BAR_WIDTH_PERCENT);
		// 最小幅に広げた結果、日の終わりからはみ出す場合は左に寄せる
		const leftPercent = Math.min(
			((start - dayStart.getTime()) / dayLength) * 100,
			100 - widthPercent,
		);
		segments.push({ dayIndex, leftPercent, widthPercent });
	});
	return segments;
}

/**
 * 同じ日の行で重なるバーを、重ならないよう段（lane）に振り分ける。
 * 左から順に、空いている一番上の段に置く。戻り値は入力と同じ順の段番号
 */
export function assignLanes(
	segments: readonly Pick<BarSegment, 'leftPercent' | 'widthPercent'>[],
): number[] {
	const order = segments
		.map((segment, index) => ({ segment, index }))
		.sort((a, b) => a.segment.leftPercent - b.segment.leftPercent);
	/** 各段の右端（%） */
	const laneEnds: number[] = [];
	const lanes = new Array<number>(segments.length).fill(0);

	for (const { segment, index } of order) {
		const lane = laneEnds.findIndex((end) => end <= segment.leftPercent);
		const assigned = lane === -1 ? laneEnds.length : lane;
		laneEnds[assigned] = segment.leftPercent + segment.widthPercent;
		lanes[index] = assigned;
	}
	return lanes;
}
