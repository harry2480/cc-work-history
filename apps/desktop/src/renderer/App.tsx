import { useEffect, useState } from 'react';
import type { PingResult } from '../shared/ipc-contract';

export function App() {
	const [ping, setPing] = useState<PingResult | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		window.api
			.ping()
			.then(setPing)
			.catch((e: unknown) => setError(String(e)));
	}, []);

	return (
		<main>
			<h1>CC Work History</h1>
			<p>Claude Code の作業履歴をカレンダー／タイムラインで可視化します。</p>
			{ping && (
				<p>
					main プロセスと接続済み（{ping.message} / Electron {ping.electronVersion}）
				</p>
			)}
			{error && <p role="alert">main プロセスとの接続に失敗しました: {error}</p>}
		</main>
	);
}
