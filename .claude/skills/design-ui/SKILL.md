---
name: design-ui
description: renderer の UI コンポーネントを作成・修正する。shadcn/ui + Tailwind CSS でデザインを実装する
---

# UI デザインスキル

ユーザーが「〇〇な画面を作って」「デザインを変えて」と指示したときに適用する。
パスは `apps/desktop/src/renderer/` からの相対パス。スタイルの詳細は `docs/スタイルガイド.md`。

## 使用する UI スタック

- **React 18**（Electron renderer。Server Component はない）
- **shadcn/ui**: `components/ui/` に配置済み（Radix UI は `radix-ui` パッケージから import）
- **Tailwind CSS v4**: スタイリング。テーマトークンは `globals.css`
- **Lucide React**: アイコン（`lucide-react` から import）
- **cn()**: `@/lib/utils/cn` で条件付きクラスを組み立てる

## shadcn/ui コンポーネントの追加

`components.json` は置いていないため、shadcn CLI は使わない。必要なコンポーネントは shadcn/ui のソースを `components/ui/{name}.tsx` に追加し、既存ファイル（例: `components/ui/switch.tsx`）に合わせて import を `radix-ui` と `@/lib/utils/cn` に揃える。新しい依存パッケージが必要ならユーザーに確認する。

## コンポーネント配置

| 種類 | 配置先 |
|---|---|
| shadcn/ui 基本コンポーネント | `components/ui/` |
| アプリシェル・サイドナビ | `components/layouts/` |
| 機能をまたぐ汎用部品（空状態など） | `components/elements/` |
| 機能固有コンポーネント | `features/{feature}/components/` |
| 座標計算・色割り当てなどの純粋関数 | `features/{feature}/utils/`, `lib/` |

## ルール

- 色は shadcn/ui のテーマトークン（`bg-background`, `text-muted-foreground` など）を使い、hex 値を直接書かない。セッションの色は `lib/config/palette.ts` から割り当てる
- ライト / ダーク両テーマで崩れないこと
- 画面全体は固定し内部でスクロールする（`h-dvh overflow-hidden`、子は `min-h-0 overflow-auto`）
- inline style は動的な位置・サイズ（タイムラインの `left` / `width` など）だけに使う
- 色だけで情報を区別しない。キーボード操作と ARIA 属性（`aria-label`, `aria-current` など）に対応する
- データは feature の `api/` フック経由で受け取り、コンポーネントから `window.api` を直接呼ばない
- Node.js API を使わない。main のコードを import しない
- 表示ロジックのあるコンポーネントは `test/unit/renderer/...` に React Testing Library のテストを書く（`window.api` はモックする）
- 変更後に `pnpm verify` を実行する。見た目の確認は `pnpm dev` で起動したアプリで行う（起動前にユーザーに確認する）
