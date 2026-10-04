---
name: review
description: コードレビュー・テストガイドラインチェック・アーキテクチャ/コード品質チェックを同時実行する
---

# Review

コードレビュー・テストガイドラインチェック・アーキテクチャ/コード品質チェックを**同時に実行**するセルフレビュースキル。

## 使い方

引数なしで実行すると、main ブランチとの差分をレビューする。

```
/review
/review "IPC の入力検証を重点的にチェックして"
```

## ワークフロー

### Step 1: 差分の確認

```bash
git branch --show-current
git diff --stat main...HEAD
```

変更がない場合（かつ未コミット変更もない場合）はユーザーに通知して終了する。
未コミット変更がある場合は `git diff --stat` も確認する。

### Step 2: 3つのチェックを同時実行

以下の3つを **並列に** 起動する（同一メッセージ内で3つの Tool call を発行）。

#### 2a. Codex Review（Bash で実行）

`command -v codex` で `codex` CLI がある場合のみ実行する。ない場合はスキップしてその旨を報告する。

```bash
# 引数なしの場合
codex review --base main

# 引数ありの場合
codex review --base main "{ユーザーの指示}"
```

タイムアウトは5分（300000ms）に設定する。

#### 2b. テストガイドラインチェック（Agent ツール、`subagent_type: "general-purpose"`）

`docs/テストガイドライン.md` と `CLAUDE.md` の「テスト」節を読ませ、差分について以下を確認させる。

- テスト追加が必須のケース（JSONL 解析・時間/トークン集計・DB スキーマ/マイグレーションの変更）でテストが追加されているか
- 配置がソース構造をミラーしているか（`apps/desktop/test/unit/`, `apps/desktop/test/integration/`）
- Integration テストが一時ディレクトリの SQLite を使い、`afterEach` で片付け、DB の状態まで検証しているか
- 実際のセッションログをフィクスチャとしてコミットしていないか

#### 2c. アーキテクチャ・コード品質チェック（Agent ツール、`subagent_type: "general-purpose"`）

`CLAUDE.md`、`docs/アーキテクチャ.md`、`docs/フロントエンド規約.md`、`docs/リポジトリ層設計規約.md`、`docs/スタイルガイド.md` のうち差分に関係するものを読ませ、以下を確認させる。

- 依存方向（`presentation → application → domain ← infrastructure`）、renderer が main を import していないか
- IPC のチャンネル・型が `src/shared/ipc-contract.ts` にだけ定義され、loader / action の入口で引数を検証しているか
- Rich Domain Model・`Result<T, E>`・クラスベースのサービス・命名規約・`index.ts` バレル禁止
- SQL がプリペアドステートメントで書かれているか、複数テーブルの書き込みがトランザクションか
- 外部プロセス・ファイルシステムに触れる Gateway に Stub があるか
- 可読性・重複・不要な複雑さ

**重要**: 2a, 2b, 2c は必ず並列（同一メッセージ内で3つの Tool call）で実行すること。

### Step 3: 結果の報告

3つの結果をまとめてユーザーに表示する。

1. **Codex Review 結果**（スキップした場合はその旨）
2. **テストガイドラインチェック結果**
3. **アーキテクチャ・コード品質チェック結果**

## 注意事項

- レビュー対象はデフォルトで `main` ブランチとの差分
- レビューで指摘した内容の修正は、ユーザーの指示があってから行う
