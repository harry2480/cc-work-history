---
allowed-tools: Bash(*), Read, Write, Edit, Glob, Grep
description: プロジェクトの初期セットアップ（前提ツールのインストールから起動確認まで）
---

## タスク

Mac をクリーンインストールした直後の人でもプロジェクトを動かせるよう、前提ツールの確認・インストールから開発サーバー起動までを一気通貫で行う。

各ステップで **コマンドの存在確認を行い、未インストールなら案内またはインストールする**。ユーザーには進捗を都度報告し、何をやっているか分かるようにする。

### Loop Engineering の選択

初期設定時にLoop Engineeringを利用するか確認する。利用する場合は `docs/loop-engineering.md` を読み、実際のdefault branch、CIコマンド、package manager、monorepo構成に合わせてLoop関連workflow・CodeRabbit設定を調整し、必要なIssueラベルを案内する。利用しない場合はLoop用workflowとラベルを無効化し、通常PRフローを維持する。GitHubのbranch protectionやAllow auto-merge設定を確認・変更したと偽らず、必要なGitHub UI設定を利用者に案内する。

---

### Step 1: Homebrew

`brew --version` で確認する。未インストールの場合:

- 「Homebrew がインストールされていません。インストールしますか？」とユーザーに確認する
- 了承を得たら `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"` を実行する
- インストール後、シェルのパスが通っているか `brew --version` で再確認する。パスが通っていなければ `eval "$(/opt/homebrew/bin/brew shellenv)"` を案内する

### Step 2: Node.js

`node --version` で確認する。未インストール、または v22 未満の場合:

- `brew install node@22` でインストールする
- インストール後 `node --version` で v22 以上であることを確認する

### Step 3: pnpm

`pnpm --version` で確認する。未インストールの場合:

- `corepack enable && corepack prepare pnpm@latest --activate` でインストールする
- corepack が使えない場合は `npm install -g pnpm` にフォールバックする

### Step 4: 依存パッケージのインストール

`node_modules/` が存在するか確認する。なければ `pnpm install` を実行する。

> データは SQLite（アプリ起動時に自動作成）に保存するため、DB サーバーの構築は不要。

### Step 5: 動作確認

`pnpm dev` を起動して、アプリが起動することを確認する。

---

### 完了報告

以下をユーザーに報告する:

- インストールしたツールの一覧（新規インストールしたもののみ）
- 「`pnpm dev` で開発サーバーを起動できます」という案内
