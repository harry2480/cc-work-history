/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
	forbidden: [
		// --- main プロセスの DDD 4 層（docs/アーキテクチャ.md） ---
		// domain → 外部層 禁止
		{
			name: 'domain-no-depend-on-outer-layers',
			severity: 'error',
			comment: 'domain 層は application, infrastructure, presentation に依存してはならない',
			from: { path: 'src/main/backend/domain/' },
			to: {
				path: [
					'src/main/backend/application/',
					'src/main/backend/infrastructure/',
					'src/main/backend/presentation/',
				],
			},
		},
		// domain → electron / Node.js 組み込みモジュール 禁止
		{
			name: 'domain-no-depend-on-runtime',
			severity: 'error',
			comment: 'domain 層は electron や Node.js 組み込みモジュールに依存してはならない',
			from: { path: 'src/main/backend/domain/' },
			to: { dependencyTypes: ['core'] },
		},
		{
			name: 'domain-no-depend-on-electron',
			severity: 'error',
			comment: 'domain 層は electron に依存してはならない',
			from: { path: 'src/main/backend/domain/' },
			to: { path: 'node_modules/electron/' },
		},
		// application → infrastructure 禁止
		{
			name: 'application-no-depend-on-infrastructure',
			severity: 'error',
			comment:
				'application 層は infrastructure に直接依存してはならない（Gateway interface 経由のみ）',
			from: { path: 'src/main/backend/application/' },
			to: { path: 'src/main/backend/infrastructure/' },
		},
		// presentation/loaders, actions, events → domain・infrastructure 禁止
		{
			name: 'presentation-handlers-no-depend-on-domain-or-infrastructure',
			severity: 'error',
			comment:
				'presentation/loaders, actions, events は domain・infrastructure に直接依存してはならない（composition 経由で解決）',
			from: { path: 'src/main/backend/presentation/(loaders|actions|events)/' },
			to: { path: ['src/main/backend/domain/', 'src/main/backend/infrastructure/'] },
		},

		// --- プロセス境界（docs/フロントエンド規約.md） ---
		// renderer → main 禁止
		{
			name: 'renderer-no-depend-on-main',
			severity: 'error',
			comment:
				'renderer は main のコードを import してはならない（window.api と src/shared/ のみ）',
			from: { path: 'src/renderer/' },
			to: { path: 'src/main/' },
		},
		// renderer → Node.js 組み込みモジュール 禁止
		{
			name: 'renderer-no-depend-on-node-builtins',
			severity: 'error',
			comment: 'renderer は Node.js 組み込みモジュール（fs, child_process など）を使ってはならない',
			from: { path: 'src/renderer/' },
			to: { dependencyTypes: ['core'] },
		},
	],
	options: {
		doNotFollow: {
			path: ['node_modules'],
		},
		tsPreCompilationDeps: true,
		tsConfig: {
			// renderer の @ エイリアスを解決するため
			fileName: './tsconfig.web.json',
		},
		enhancedResolveOptions: {
			exportsFields: ['exports'],
			conditionNames: ['import', 'require', 'node', 'default'],
		},
		reporterOptions: {
			text: {
				highlightFocused: true,
			},
		},
	},
};
