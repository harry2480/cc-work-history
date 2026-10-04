type Props = {
	title: string;
	description: string;
};

export function PagePlaceholder({ title, description }: Props) {
	return (
		<div className="min-h-0 flex-1 overflow-auto p-6">
			<h2 className="text-lg font-bold">{title}</h2>
			<p className="mt-2 text-sm text-muted-foreground">{description}</p>
		</div>
	);
}
