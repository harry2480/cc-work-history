import { Button } from '@/components/ui/button';
import { type ColorBy, useDisplaySettingsStore } from '@/stores/display-settings-store';

const OPTIONS: { value: ColorBy; label: string }[] = [
	{ value: 'project', label: 'プロジェクト' },
	{ value: 'tag', label: 'タグ' },
	{ value: 'status', label: 'ステータス' },
];

export function ColorBySwitch() {
	const colorBy = useDisplaySettingsStore((s) => s.colorBy);
	const setColorBy = useDisplaySettingsStore((s) => s.setColorBy);

	return (
		<fieldset className="flex items-center gap-1">
			<legend className="sr-only">色分け</legend>
			<span className="mr-1 whitespace-nowrap text-xs text-muted-foreground" aria-hidden>
				色分け
			</span>
			{OPTIONS.map((option) => (
				<Button
					key={option.value}
					size="sm"
					variant={colorBy === option.value ? 'default' : 'outline'}
					aria-pressed={colorBy === option.value}
					onClick={() => setColorBy(option.value)}
				>
					{option.label}
				</Button>
			))}
		</fieldset>
	);
}
