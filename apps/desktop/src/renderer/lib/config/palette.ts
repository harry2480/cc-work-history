/** プロジェクトの色。globals.css の --project-color-N（ライト／ダークで値が変わる） */
const PROJECT_COLOR_COUNT = 10;

/** プロジェクト ID から、毎回同じ色を選ぶ */
export function projectColor(projectId: string): string {
	let hash = 0;
	for (const char of projectId) {
		hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
	}
	return `var(--project-color-${(hash % PROJECT_COLOR_COUNT) + 1})`;
}
