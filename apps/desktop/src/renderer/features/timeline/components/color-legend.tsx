import type { ColorBy } from '@/stores/display-settings-store';
import type { ColorGroup } from '../utils/color-by';

type Props = {
	groups: readonly ColorGroup[];
	colorBy: ColorBy;
};

export function ColorLegend({ groups, colorBy }: Props) {
	if (groups.length === 0) return null;
	return (
		<div className="flex flex-col gap-1 text-xs">
			<ul aria-label="凡例" className="flex flex-wrap gap-x-3 gap-y-1">
				{groups.map((group) => (
					<li key={group.key} className="flex items-center gap-1">
						<span
							aria-hidden
							className="inline-block size-3 rounded-sm bg-[var(--legend-color)]"
							style={{ '--legend-color': group.color } as React.CSSProperties}
						/>
						{group.label}
					</li>
				))}
			</ul>
			{colorBy === 'tag' && (
				<p className="text-muted-foreground">
					複数のタグを持つセッションは、最初のタグの色で表示します。
				</p>
			)}
		</div>
	);
}
