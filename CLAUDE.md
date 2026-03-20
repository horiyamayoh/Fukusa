# CLAUDE.md -- AI Agent Development Guide

このファイルは AI エージェント (Claude Code, Copilot, Cursor 等) が Fukusa リポジトリで効率的に開発を行うためのガイドです。

## プロジェクト概要

**Fukusa** (袱紗) は VS Code 拡張機能で、Git/SVN リポジトリ内の同一ファイルについて任意の N 個のリビジョンをサイドバイサイドで比較表示します。旧称 MultiDiffViewer。

- **パッケージ名**: `fukusa`
- **コマンド名前空間**: `multidiff.*`
- **URI スキーム**: `multidiff://` (スナップショット), `multidiff-session-doc://` (セッションドキュメント), `multidiff-session://` (セッション識別)
- **VS Code API バージョン**: `^1.85.0`
- **ライセンス**: MIT

## ビルド・テスト・リント

```bash
# コンパイル (out/ をクリアしてから tsc)
npm run compile

# 全テスト実行 (unit + integration)
npm test

# ユニットテストのみ
npm run test:unit

# インテグレーションテストのみ
npm run test:integration

# リント
npm run lint

# VSIX パッケージ作成
npm run package:vsix
```

**注意事項:**
- ビルドは純粋な `tsc` で、webpack/esbuild は使用していない
- テストは `@vscode/test-electron` でダウンロードした VS Code インスタンス内で実行される
- ユニットテストは `^Unit:` prefixed suite name、インテグレーションテストは `^Integration:` prefixed
- テストフレームワーク: Mocha (TDD style: `suite`/`test`) + Sinon (mocking)
- Windows 環境ではパスにスペースを含む場合、junction シンボリックリンクで回避している (`runTest.ts`)

## アーキテクチャ

### レイヤー構成 (依存は上→下のみ)

```
extension.ts                    -- エントリポイント・手動 DI 配線
├── commands/                   -- コマンドハンドラー (ファクトリ関数パターン)
├── presentation/               -- UI 層
│   ├── native/                 -- ネイティブエディタサーフェス
│   ├── compare/                -- パネル (Webview) サーフェス
│   ├── decorations/            -- デコレーション (blame, diff)
│   └── views/                  -- ツリービュー (sessions, cache)
├── application/                -- ビジネスロジック
├── infrastructure/             -- インフラ (キャッシュ, FS, シャドウ, 一時ファイル)
└── adapters/                   -- VCS アダプタ (Git, SVN)
```

### 設計原則

1. **レイヤードアーキテクチャ**: 各層は下位層のみに依存
2. **手動依存性注入**: `extension.ts` が全サービスをインスタンス化・配線 (DI コンテナ不使用)
3. **イベント駆動リアクティビティ**: `SessionService` が 4 種のイベントを発火、コントローラーが反応
4. **グローバル行番号空間**: 全エディタの同期の中心軸
5. **デュアルサーフェス**: ネイティブエディタとパネルを `CompareSurfaceCoordinator` が切り替え
6. **不変セッション + 可変ビューステート**: `NWayCompareSession` は不変、`SessionViewState` は可変

### 主要ファイルと役割

| ファイル | 役割 | 重要度 |
|---------|------|--------|
| `src/extension.ts` | DI 配線・全サービスの起点 | 最重要 |
| `src/adapters/common/types.ts` | 全ドメイン型定義 (26+ interfaces/types) | 最重要 |
| `src/application/sessionService.ts` | セッション状態管理中枢 (~16.7KB) | 最重要 |
| `src/application/nWayAlignmentEngine.ts` | N-way アラインメントアルゴリズム (~15.6KB) | コア |
| `src/application/comparePairing.ts` | ペア射影ロジック (adjacent/base/all/custom) | コア |
| `src/application/compareRowProjection.ts` | 行折りたたみ射影 | コア |
| `src/application/sessionViewport.ts` | ビューポート算出 | コア |
| `src/presentation/native/nativeCompareSessionController.ts` | ネイティブエディタタブ管理 (~18.6KB) | 重要 |
| `src/presentation/native/editorSyncController.ts` | スクロール同期 (~15KB) | 重要 |
| `src/presentation/native/diffDecorationController.ts` | Diff デコレーション (~13.8KB) | 重要 |
| `src/presentation/compare/panelCompareSessionController.ts` | Webview パネル管理 (~33KB, 最大) | 重要 |
| `src/presentation/compare/compareSurfaceCoordinator.ts` | サーフェス切替 | 重要 |
| `src/commands/shared.ts` | コマンド共通ユーティリティ (~11.5KB) | 重要 |
| `src/infrastructure/fs/uriFactory.ts` | URI 生成・パース | 重要 |
| `src/infrastructure/fs/snapshotFsProvider.ts` | multidiff:// FS プロバイダ | 重要 |
| `src/infrastructure/fs/alignedSessionDocumentProvider.ts` | セッションドキュメントプロバイダ | 重要 |

### イベントフロー

`SessionService` は以下の 4 イベントを発火する:

1. **sessionCreated**: セッション新規作成時
2. **sessionRemoved**: セッション削除時
3. **viewStateChanged**: ビューステート変更時 (アクティブリビジョン、ペア、ページ)
4. **rowProjectionChanged**: 行射影状態変更時 (折りたたみ ON/OFF、ギャップ展開)

### コマンドパターン

コマンドは `commands/` ディレクトリ内のファクトリ関数で定義:

```typescript
// 例: commands/closeActiveSession.ts
export function createCloseActiveSessionCommand(ctx: CommandContext) {
  return async (...args: unknown[]) => {
    // コマンド実装
  };
}
```

`CommandContext` は `commands/commandContext.ts` で定義された DI バッグ。

### ドメインモデルの要点

- **NWayCompareSession**: 不変のセッションオブジェクト (ID, リビジョン, アラインメント結果, ペア, サーフェスモード)
- **SessionViewState**: 可変のビューステート (アクティブリビジョン, アクティブペア, ページ開始位置)
- **GlobalRow / GlobalRowCell**: N-way アラインメントの基本単位。全リビジョンを横断する行
- **ComparePairOverlay**: 2 リビジョン間のペアオーバーレイ。変更行番号を保持
- **ComparePairProjection**: adjacent/base/all/custom の 4 モード
- **RawSnapshot**: リビジョンごとのスナップショットメタデータ + 行マッピング

### URI スキーム設計

| スキーム | 用途 | AuthorityPath の規則 |
|---------|------|---------------------|
| `multidiff://` | ReadOnly 仮想 FS | `{vcsKind}/{repoId}/{path}?rev=...&path=...` |
| `multidiff-session-doc://` | アライン済みセッションドキュメント | `{sessionId}/{index}-{file}?path=...&windowStart=...&revisionIndex=...&revisionLabel=...` |
| `multidiff-session://` | セッション識別 (内部) | `{sessionId}/{path}?path=...` |

## コーディング規約

### 型定義

- 全ドメイン型は `src/adapters/common/types.ts` に集約
- `readonly` を徹底 (`readonly` modifier + `ReadonlyMap`, `readonly T[]`)
- 型エイリアスは実用上の別名として使う (例: `CompareSnapshot = RawSnapshot`)

### テスト

- ファイル命名: `{module名}.test.ts` を `src/test/unit/` または `src/test/integration/` に配置
- suite 名のプレフィックス: `Unit: ...` または `Integration: ...`
- テストヘルパー: `src/test/helpers/repoHelpers.ts` (Git/SVN テストリポジトリ作成)
- 外部依存のモック: Sinon を使用 (`sinon.stub()`, `sinon.spy()`)

### エラーハンドリング

- `OutputLogger` (`src/util/output.ts`) でログ出力 (`output.info()`, `output.warn()`, `output.error()`)
- VS Code OutputChannel に統合

### Disposable パターン

- コントローラーやサービスは `vscode.Disposable` を実装
- `extension.ts` の `context.subscriptions.push()` で一括管理

## ディレクトリ構造

```
src/
├── extension.ts                         -- エントリポイント
├── adapters/
│   ├── common/
│   │   ├── types.ts                     -- 全ドメイン型 (26+ interfaces)
│   │   └── repositoryAdapter.ts         -- VCS アダプタインターフェース
│   ├── git/
│   │   ├── gitAdapter.ts               -- Git アダプタ実装
│   │   ├── gitApi.ts                   -- VS Code Git 拡張 API ラッパー
│   │   └── gitCli.ts                   -- Git CLI ラッパー
│   └── svn/
│       ├── svnAdapter.ts               -- SVN アダプタ実装
│       └── svnCli.ts                   -- SVN CLI ラッパー
├── application/
│   ├── blameService.ts                  -- Blame データ取得・キャッシュ
│   ├── cacheService.ts                  -- 2 層キャッシュファサード
│   ├── comparePairing.ts               -- ペア射影ロジック
│   ├── compareRowDisplayState.ts        -- 行表示状態計算
│   ├── compareRowProjection.ts          -- 行折りたたみ射影
│   ├── historicalLanguageFeatureService.ts
│   ├── languageFeatureCompatibilityService.ts
│   ├── nWayAlignmentEngine.ts           -- N-way アラインメント (コア)
│   ├── repositoryRegistry.ts            -- リポジトリ登録
│   ├── repositoryService.ts             -- リポジトリサービス
│   ├── revisionPickerService.ts         -- リビジョン選択 UI
│   ├── sessionAlignmentService.ts       -- セッションアラインメントオーケストレーター
│   ├── sessionBuilderService.ts         -- セッション構築
│   ├── sessionCapabilities.ts           -- UI 能力判定
│   ├── sessionRowProjection.ts          -- セッションレベル行射影
│   ├── sessionService.ts               -- セッション状態管理 (中枢)
│   └── sessionViewport.ts              -- ビューポート計算
├── commands/                            -- 23 コマンドファイル
│   ├── commandContext.ts                -- DI バッグ
│   ├── shared.ts                        -- 共通ユーティリティ
│   └── (各コマンドファイル)
├── compatibility/                       -- 言語機能ブリッジプロバイダ
├── configuration/
│   └── extensionConfiguration.ts        -- 型安全な設定アクセサ
├── infrastructure/
│   ├── cache/
│   │   ├── cacheKeys.ts                 -- キャッシュキー生成
│   │   ├── memoryCache.ts               -- LRU メモリキャッシュ
│   │   └── persistentCache.ts           -- ファイルベース永続キャッシュ
│   ├── fs/
│   │   ├── alignedSessionDocumentProvider.ts
│   │   ├── languageModeResolver.ts
│   │   ├── snapshotFsProvider.ts
│   │   └── uriFactory.ts
│   ├── shadow/
│   │   └── shadowWorkspaceService.ts    -- シャドウワークスペース
│   └── temp/
│       └── tempSnapshotMirror.ts        -- 一時ファイルミラー
├── presentation/
│   ├── compare/
│   │   ├── comparePanelDocument.ts      -- パネル viewmodel
│   │   ├── compareSurfaceCoordinator.ts -- サーフェス切替
│   │   ├── panelCompareSessionController.ts  -- パネルコントローラー (最大 ~33KB)
│   │   └── prototypeComparePanel.ts     -- プロトタイプ (参考保持)
│   ├── decorations/
│   │   └── blameDecorationController.ts
│   ├── native/
│   │   ├── diffDecorationController.ts
│   │   ├── editorLayoutController.ts
│   │   ├── editorSyncController.ts
│   │   └── nativeCompareSessionController.ts
│   └── views/
│       ├── cacheTreeProvider.ts
│       └── sessionsTreeProvider.ts
├── test/
│   ├── runTest.ts                       -- テストランナー
│   ├── runIntegration.ts                -- インテグレーションテストランナー
│   ├── suite/index.ts                   -- Mocha suite エントリ
│   ├── helpers/repoHelpers.ts           -- テストヘルパー
│   ├── unit/                            -- 39 ユニットテストファイル
│   └── integration/                     -- 3 インテグレーションテストファイル
├── types/                               -- (空)
└── util/
    ├── disposable.ts                    -- Disposable ユーティリティ
    ├── hash.ts                          -- ハッシュユーティリティ
    ├── output.ts                        -- OutputChannel ロガー
    └── process.ts                       -- 子プロセス実行
```

## N-Way アラインメントアルゴリズム概要

`nWayAlignmentEngine.ts` の中核アルゴリズム:

1. **ペアワイズ diff**: `diff` ライブラリの `diffLines` で隣接リビジョン間の差分を計算
2. **BiGram Dice 類似度**: 変更チャンク内の行マッチングに使用
3. **DP マトリクス / グリーディマッチング**: 置換ハンク内の行対応付け
4. **プログレッシブ N-way マージ**: ペアワイズ結果を左から右へ順次マージし、グローバル行番号を決定
5. **インライン差分**: 変更行に対して `diffWordsWithSpace` で単語レベル差分を計算

## スクロール同期の定数

| 定数 | 値 | 用途 |
|------|----|------|
| DEBOUNCE | 32ms | スクロールイベントのデバウンス |
| VERIFY | 80ms | 同期検証のディレイ |
| FEEDBACK_SUPPRESS | 150ms | フィードバックループ抑制 |
| STICKY_SCROLL_PADDING | 補正あり | VS Code sticky scroll の高さ補正 |

## 既知の制約

- 単一ファイル比較のみ (ディレクトリレベル比較は未対応)
- 行ベースアラインメント (文字レベル移動は未検出)
- ネイティブモードのスクロール同期はピクセル精度ではなく行ベース
- ネイティブモードの同時表示上限: 9 リビジョン (`MAX_VISIBLE_REVISIONS = 9`)
- シャドウワークスペースのファイル実体化は I/O コストが高い

## ドキュメント一覧

| ファイル | 内容 | 言語 |
|---------|------|------|
| `README.md` | プロジェクト概要・コマンド・設定・開発方法 | 英語 |
| `CLAUDE.md` | AI エージェント向け開発ガイド (本ファイル) | 日本語 |
| `CHANGELOG.md` | 変更履歴 | 日本語 |
| `PUBLISHING.md` | VS Code Marketplace 公開手順 | 日本語 |
| `docs/SPEC.md` | コードベースから逆引きした包括的仕様書 | 日本語 |
| `docs/USER_GUIDE.md` | エンドユーザーガイド | 英語 |
| `docs/Fukusa_design_v0.2.md` | 初期設計ドキュメント (Native Editor First) | 日本語 |
| `docs/Fukusa_nway_redesign_plan_2026-03-15.md` | N-way 再設計計画 | 日本語 |
| `docs/adr_003_*` ~ `docs/adr_010_*` | Architecture Decision Records | 日本語 |

## よくある開発タスクの手順

### 新しいコマンドを追加する

1. `src/commands/` に新しいファイルを作成 (ファクトリ関数パターン)
2. `src/commands/commandContext.ts` に必要な依存があるか確認
3. `src/extension.ts` でコマンドを登録 (`vscode.commands.registerCommand`)
4. `package.json` の `contributes.commands` にコマンド定義を追加
5. `package.json` の `activationEvents` にコマンドイベントを追加
6. 必要に応じて `contributes.menus` にメニュー項目を追加
7. `src/test/unit/` にテストを追加

### 新しいドメイン型を追加する

1. `src/adapters/common/types.ts` に型定義を追加
2. 関連するサービスやコントローラーで import

### セッションイベントに反応するコントローラーを追加する

1. `SessionService` のイベントリスナーを登録
2. `vscode.Disposable` を実装してクリーンアップ
3. `extension.ts` の `subscriptions` に追加

### テストの書き方

```typescript
suite('Unit: MyService', () => {
  let sut: MyService;
  let dep: sinon.SinonStubbedInstance<Dependency>;

  setup(() => {
    dep = sinon.createStubInstance(Dependency);
    sut = new MyService(dep);
  });

  teardown(() => sinon.restore());

  test('should do something', () => {
    // arrange
    dep.method.returns(value);
    // act
    const result = sut.doSomething();
    // assert
    assert.strictEqual(result, expected);
  });
});
```
