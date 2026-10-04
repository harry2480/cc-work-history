import type { FilterOptionsDto } from '@shared/ipc-contract';
import { useSettings } from '../api/use-settings';
import { ColorSection } from './color-section';
import { DataPathsSection } from './data-paths-section';
import { IdleThresholdSection } from './idle-threshold-section';
import { ThemeSection } from './theme-section';

type Props = {
	filterOptions: FilterOptionsDto;
};

export function SettingsView({ filterOptions }: Props) {
	const { data, error, updateIdleThreshold } = useSettings();

	return (
		<div className="mx-auto flex max-w-3xl flex-col gap-4">
			<h1 className="text-lg font-bold">設定</h1>
			{error && (
				<p role="alert" className="text-sm text-destructive">
					設定を読み込めませんでした: {error}
				</p>
			)}
			{data && <DataPathsSection settings={data} />}
			<ThemeSection />
			<ColorSection projects={filterOptions.projects} tags={filterOptions.tags} />
			{data && <IdleThresholdSection settings={data} onSave={updateIdleThreshold} />}
		</div>
	);
}
