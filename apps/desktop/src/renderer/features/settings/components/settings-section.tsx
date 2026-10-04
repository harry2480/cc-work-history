import type { ReactNode } from 'react';

type Props = {
	title: string;
	description?: string;
	children: ReactNode;
};

export function SettingsSection({ title, description, children }: Props) {
	return (
		<section className="flex flex-col gap-3 rounded-lg border p-4">
			<div>
				<h2 className="text-sm font-bold">{title}</h2>
				{description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
			</div>
			{children}
		</section>
	);
}
