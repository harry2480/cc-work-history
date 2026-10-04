---
name: add-page
description: 新しい画面を追加する。表示内容とデータソースを指定して、renderer のページ・サイドナビ・データ取得フックを作成する
---

# ページ追加スキル

ユーザーが「〇〇画面を作って」と指示したときに適用する。

renderer にはルーターがなく、`App.tsx` が `PageKey` で画面を切り替える。パスは `apps/desktop/src/renderer/` からの相対パス。

## 生成・更新するファイル

1. **PageKey**（`pages/page-key.ts`）
   - `PageKey` のユニオン型にキーを追加する（kebab-case。例: `'session-list'`）

2. **ページ**（`pages/{name}-page.tsx`）
   - features のコンポーネントを組み合わせるだけ。ロジック・データ取得を書かない
   - ルートは `flex min-h-0 flex-1`、スクロール領域は `min-h-0 overflow-auto`（`docs/スタイルガイド.md`）
   - 例: `pages/session-list-page.tsx`

3. **画面切り替えとナビ**
   - `App.tsx` の `pages` にキーとコンポーネントを追加する
   - `components/layouts/sidebar-nav.tsx` の `navItems` にラベルと `lucide-react` のアイコンを追加する

4. **feature**（`features/{feature}/`）
   - `api/use-{name}.ts`: `window.api` をラップしたフック。`onSessionsChanged` を購読して取り直す（例: `features/session-list/api/use-session-list.ts`）
   - `components/`: 表示コンポーネント
   - `utils/`: 純粋関数（テスト対象）
   - feature 同士は直接 import せず、ページで組み合わせる

5. **必要に応じて main 側も追加**
   - 既存の `window.api` のメソッドで足りなければ、`add-feature` スキルの手順で IPC 契約・UseCase・loader・preload を追加する

## ルール

- データ取得は必ず feature の `api/` フック経由（`window.api` をコンポーネントから直接呼ばない）
- Zustand（`stores/`）は UI の状態だけに使い、セッションデータを複製しない
- UI は shadcn/ui（`components/ui/`）+ Tailwind CSS で構築する（`design-ui` スキル参照）
- Node.js API を使わない。main のコードを import しない
- 変更後に `pnpm verify` を実行する
