/**
 * main で投げたエラーの表示用の文言。
 * Electron が付ける「Error invoking remote method '...': XxxError: 」の前置きを取り除く
 */
export function ipcErrorMessage(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	return message.replace(/^Error invoking remote method '[^']*': (?:[A-Za-z]*Error: )?/, '');
}
