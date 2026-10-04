import { Button } from '@/components/ui/button';
import { type Theme, useDisplaySettingsStore } from '@/stores/display-settings-store';
import { SettingsSection } from './settings-section';

const THEMES: { value: Theme; label: string }[] = [
	{ value: 'light', label: 'ライト' },
	{ value: 'dark', label: 'ダーク' },
	{ value: 'system', label: 'OS に従う' },
];

export function ThemeSection() {
	const theme = useDisplaySettingsStore((s) => s.theme);
	const setTheme = useDisplaySettingsStore((s) => s.setTheme);

	return (
		<SettingsSection title="テーマ">
			<fieldset className="flex gap-1">
				<legend className="sr-only">テーマ</legend>
				{THEMES.map(({ value, label }) => (
					<Button
						key={value}
						size="sm"
						variant={theme === value ? 'default' : 'outline'}
						aria-pressed={theme === value}
						onClick={() => setTheme(value)}
					>
						{label}
					</Button>
				))}
			</fieldset>
		</SettingsSection>
	);
}
