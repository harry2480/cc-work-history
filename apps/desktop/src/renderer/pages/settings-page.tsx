import { useFilterOptions } from '@/features/filters/api/use-filter-options';
import { SettingsView } from '@/features/settings/components/settings-view';

export function SettingsPage() {
	const filterOptions = useFilterOptions();

	return (
		<div className="min-h-0 flex-1 overflow-auto p-6">
			<SettingsView filterOptions={filterOptions} />
		</div>
	);
}
