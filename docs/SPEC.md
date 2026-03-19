# Fukusa -- N-Way Diff Viewer 仕様書

> リバースエンジニアリングにより既存コードベースから抽出した仕様。
> ソースコード v0.0.1 (`native-editor-first-compare` ブランチ) を基準とする。

---

## 目次

1. [製品概要](#1-製品概要)
2. [アーキテクチャ仕様](#2-アーキテクチャ仕様)
3. [ドメインモデル仕様](#3-ドメインモデル仕様)
4. [機能仕様](#4-機能仕様)
5. [コマンド・UI 仕様](#5-コマンドui-仕様)
6. [データフロー仕様](#6-データフロー仕様)
7. [既知の課題・将来計画](#7-既知の課題将来計画)

---

## 1. 製品概要

### 1.1 プロダクト名

**Fukusa** (袱紗) -- 旧称 MultiDiffViewer

### 1.2 目的

Git / SVN リポジトリ内の同一ファイルについて、**任意の N 個のリビジョン**をサイドバイサイドで比較表示する VS Code 拡張機能を提供する。

### 1.3 対象ユーザー

- ソースコード変更履歴をレビューする開発者
- リファクタリングの影響範囲を複数リビジョンにまたがって調査する開発者
- 特定のファイルの進化過程を可視化・分析する開発者

### 1.4 差別化要素

| 観点 | 既存ツール (2-way diff) | Fukusa |
|------|------------------------|--------|
| 比較可能なリビジョン数 | 2 | 任意の N 個 |
| 表示方式 | ネイティブ diff エディタ (1ペア) | N 個のネイティブエディタ並列 or 単一パネル |
| 行アラインメント | ペアワイズ | N-way グローバル行アラインメント |
| ペア選択モード | 固定 (左/右) | adjacent / base / all / custom |
| 未変更行の折りたたみ | なし | コンテキスト行付きギャップ折りたたみ |
| Blame ヒートマップ | なし | 年齢バケットベースの色分け |

### 1.5 システム要件

| 項目 | 最小要件 |
|------|---------|
| VS Code | 1.85.0 以上 |
| 拡張機能依存 | `vscode.git` (VS Code 組み込み Git) |
| VCS | Git または SVN (CLI 必須) |
| プラットフォーム | Windows / macOS / Linux |

### 1.6 設定項目

| 設定キー | 型 | デフォルト | 説明 |
|---------|---|----------|------|
| `multidiff.blame.mode` | `"age"` | `"age"` | Blame ヒートマップの表示モード |
| `multidiff.blame.showOverviewRuler` | `boolean` | `true` | Blame 色をオーバービュールーラーに表示するか |
| `multidiff.cache.maxSizeMb` | `number` | `512` | インメモリキャッシュの最大サイズ (MiB) |

---

## 2. アーキテクチャ仕様

### 2.1 レイヤー構成

```
┌─────────────────────────────────────────────────┐
│                  extension.ts                    │  エントリポイント・DI 配線
├──────────────┬──────────────────────────────┬────┤
│   commands/  │     presentation/            │    │  UI 層
│              ├───── native/                 │    │
│              ├───── compare/                │    │
│              ├───── decorations/            │    │
│              └───── views/                  │    │
├──────────────┴──────────────────────────────┤    │
│             application/                    │    │  ビジネスロジック層
├─────────────────────────────────────────────┤    │
│             infrastructure/                 │    │  インフラ層
│  ├── cache/ (メモリ / 永続)                  │    │
│  ├── fs/ (仮想ファイルシステム / URI)         │    │
│  ├── shadow/ (シャドウワークスペース)          │    │
│  └── temp/ (一時ファイルミラー)               │    │
├─────────────────────────────────────────────┤    │
│             adapters/                       │    │  VCS アダプタ層
│  ├── common/types.ts                        │    │
│  ├── git/                                   │    │
│  └── svn/                                   │    │
└─────────────────────────────────────────────┘
```

### 2.2 設計原則

1. **レイヤードアーキテクチャ**: 各層は下位層のみに依存し、上位層へは依存しない
2. **手動依存性注入**: `extension.ts` がすべてのサービスをインスタンス化し配線する (DI コンテナ不使用)
3. **イベント駆動リアクティビティ**: `SessionService` が4種のイベントを発火し、コントローラー・ツリービュー・コンテキストキーが反応する
4. **グローバル行番号**: 全エディタで共有されるグローバル行番号空間を同期の中心軸とする
5. **デュアルサーフェス**: ネイティブエディタ (複数タブ) とパネル (単一 Webview) の2つの表示方式を同一コーディネーターで切り替え

### 2.3 依存ライブラリ

| パッケージ | バージョン | 用途 |
|-----------|---------|------|
| `diff` | ^5.2.0 | `diffLines` / `diffWordsWithSpace` によるテキスト差分計算 |
| `fast-xml-parser` | ^5.5.5 | SVN XML 出力のパース |
| `lru-cache` | ^10.1.0 | メモリキャッシュの LRU 管理 |
| `uuid` | ^9.0.0 | セッション ID 生成 |

### 2.4 URI スキーム設計

| スキーム | 用途 | 例 |
|---------|------|-----|
| `multidiff://` | ReadOnly 仮想ファイルシステム (スナップショットバイト) | `multidiff://git/repoId/path/file.ts?rev=abc123&path=src/file.ts` |
| `multidiff-session-doc://` | セッションドキュメント (アライン済み仮想文書) | `multidiff-session-doc://sessionId/00-file.ts?path=...&windowStart=0&revisionIndex=0&revisionLabel=r0` |
| `multidiff-session://` | セッション識別 (内部) | `multidiff-session://sessionId/path?path=...` |

---

## 3. ドメインモデル仕様

### 3.1 中核エンティティ

#### 3.1.1 NWayCompareSession

セッション全体を表す最上位エンティティ。

```
NWayCompareSession
  id: string                        -- UUID
  uri: Uri                          -- セッション URI
  repo: RepoContext                  -- リポジトリ情報
  originalUri: Uri                   -- ファイルシステム上の元ファイル URI
  relativePath: string               -- リポジトリルートからの相対パス
  revisions: RevisionRef[]           -- 選択されたリビジョン一覧
  createdAt: number                  -- 作成タイムスタンプ
  rowCount: number                   -- グローバル行の総数
  rawSnapshots: RawSnapshot[]        -- リビジョンごとのスナップショット
  globalRows: GlobalRow[]            -- N-way アライメント結果
  adjacentPairs: AdjacentPairOverlay[]  -- 隣接ペアのオーバーレイ (事前計算)
  pairProjection: ComparePairProjection -- ペア射影モード
  surfaceMode: CompareSurfaceMode    -- 表示モード
```

#### 3.1.2 GlobalRow / GlobalRowCell

N-way アラインメントの基本単位。

```
GlobalRow
  rowNumber: number                  -- 1-based グローバル行番号
  cells: GlobalRowCell[]             -- リビジョンごとのセル

GlobalRowCell extends AlignedLine
  revisionIndex: number              -- リビジョンインデックス
  rowNumber: number                  -- グローバル行番号
  present: boolean                   -- この行にコンテンツがあるか
  text: string                       -- 行テキスト (空行は "")
  originalLineNumber?: number        -- 元ファイルでの行番号
  prevChange?: AlignedLineChange     -- 前リビジョンとの差分情報
  nextChange?: AlignedLineChange     -- 次リビジョンとの差分情報
  blameAgeBucket?: number            -- Blame 年齢バケット (0-4)
```

#### 3.1.3 RawSnapshot

各リビジョンのスナップショットメタデータ。

```
RawSnapshot
  snapshotUri: Uri                   -- multidiff:// スキームでのスナップショット URI
  rawUri: Uri                        -- シャドウワークスペース上の実ファイル URI
  revisionIndex: number              -- 0-based リビジョンインデックス
  revisionId: string                 -- リビジョン識別子 (コミットハッシュ等)
  revisionLabel: string              -- 短縮表示ラベル
  relativePath: string               -- 相対パス
  lineMap: AlignedLineMap            -- 双方向行番号マッピング
```

#### 3.1.4 SessionFileBinding

エディタとセッションを結びつけるバインディング。

```
SessionFileBinding
  sessionId: string
  revisionIndex: number
  revisionId: string
  relativePath: string
  rawUri: Uri
  documentUri: Uri                   -- エディタが表示するドキュメントの URI
  lineNumberSpace: 'original' | 'globalRow'
  windowStart?: number               -- 表示ウィンドウの開始リビジョンインデックス
  projectedGlobalRows?: number[]     -- 射影後のグローバル行番号リスト
  projectedLineMap?: SessionProjectedLineMap  -- ドキュメント行<->グローバル行マッピング
```

### 3.2 ビューステート

#### 3.2.1 SessionViewState

セッションごとのビュー状態。

```
SessionViewState
  activeRevisionIndex: number        -- フォーカスされているリビジョン
  activePairKey?: string             -- アクティブなペアキー (例: "0:1")
  pageStart: number                  -- ネイティブモードでのページ開始位置
```

#### 3.2.2 SessionRowProjectionState

行折りたたみ状態。

```
SessionRowProjectionState
  collapseUnchanged: boolean         -- 未変更行の折りたたみが有効か
  expandedGapKeys: string[]          -- ユーザーが展開したギャップキー一覧
```

### 3.3 ペアモデル

#### 3.3.1 ComparePairOverlay

2つのリビジョン間の比較ペアを表すオーバーレイ。

```
ComparePairOverlay
  leftRevisionIndex: number
  rightRevisionIndex: number
  key: string                        -- "left:right" 形式
  label: string                      -- 表示ラベル
  changedRowNumbers: number[]        -- 変更のあるグローバル行番号
```

#### 3.3.2 ComparePairProjection

ペア射影モードの定義。

| モード | 説明 | 生成されるペア (N=5) |
|--------|------|---------------------|
| `adjacent` | 隣接リビジョンのペア | `0:1, 1:2, 2:3, 3:4` |
| `base` | 先頭リビジョンとの全ペア | `0:1, 0:2, 0:3, 0:4` |
| `all` | 全組み合わせ | `0:1, 0:2, ..., 3:4` (10ペア) |
| `custom` | ユーザー指定 | 任意の `pairKeys` |

### 3.4 表示モデル

#### 3.4.1 VisibleRevisionWindow

ネイティブモードでのリビジョン表示ウィンドウ。

```
VisibleRevisionWindow
  startRevisionIndex: number         -- ウィンドウの開始インデックス
  endRevisionIndex: number           -- ウィンドウの終了インデックス
  rawSnapshots: RawSnapshot[]        -- ウィンドウ内のスナップショット
```

定数: `MAX_VISIBLE_REVISIONS = 9` (ネイティブモードの同時表示上限)

パネルモードでは常に全リビジョンを表示する。

#### 3.4.2 SessionProjectedLineMap

行折りたたみ時のドキュメント行 <-> グローバル行の双方向マッピング。

```
SessionProjectedLineMap
  documentLineToGlobalRow: Map<number, number>   -- 1-based ドキュメント行 → グローバル行
  globalRowToDocumentLine: Map<number, number>   -- グローバル行 → 1-based ドキュメント行
```

#### 3.4.3 CompareProjectedRow

射影後の行を表す共用体型。

```
CompareProjectedDataRow              -- 表示されるデータ行
  kind: 'data'
  rowNumber: number

CompareProjectedGapRow               -- 折りたたまれたギャップ
  kind: 'gap'
  gapKey: string                     -- "startRow:endRow" 形式
  startRowNumber: number
  endRowNumber: number
  hiddenRowCount: number
```

---

## 4. 機能仕様

### 4.1 N-Way アラインメントエンジン

#### 4.1.1 アルゴリズム概要

```
入力: linesBySource[0..N-1]  -- 各リビジョンの行テキスト配列
出力: CanonicalRow[]          -- グローバル行のアラインメント結果

手順:
  1. rows ← linesBySource[0] の各行を CanonicalRow に変換
  2. for i = 1 to N-1:
     a. pairRows ← buildPairAlignmentRows(linesBySource[i-1], linesBySource[i])
     b. rows ← mergePairRows(rows, pairRows, ...)
  3. return rows
```

#### 4.1.2 ペアワイズアラインメント

1. `diff` ライブラリの `diffLines()` で隣接リビジョン間のテキスト差分を計算
2. 一致ブロック: 左右の行を1:1で対応
3. 置換ブロック (removed + added):
   - 各行の BiGram Dice 類似度を計算
   - `MATCH_SIMILARITY_THRESHOLD = 0.3` 以上で対応付け
   - ブロックサイズに応じて最適化:
     - `leftCount * rightCount <= MAX_ALIGNMENT_MATRIX_CELLS (1,500,000)`: DP行列による最適アラインメント
     - それ以上: `MATCH_LOOKAHEAD = 6` の貪欲マッチング
4. 挿入/削除ブロック: 空行との対応

#### 4.1.3 N-Way マージ

ペアワイズ結果を `mergePairRows` で順次マージ。前リビジョンの行番号をアンカーとして、新リビジョンの行を既存のグローバル行に統合する。

#### 4.1.4 行内差分 (Intraline Diff)

変更行に対して `diffWordsWithSpace()` を適用し、単語レベルの差分 (`IntralineSegment[]`) を計算する。

### 4.2 スクロール同期

#### 4.2.1 基本メカニズム

```
1. VS Code の onDidChangeTextEditorVisibleRanges イベントをリスン
2. ソースエディタの topLine → グローバル行番号に変換
3. 32ms デバウンス後、全ピアエディタに対して:
   a. グローバル行番号 → ターゲットエディタのドキュメント行に変換
   b. editor.revealRange(targetLine, AtTop) を呼び出し
4. 80ms 後に検証パスを実行:
   a. 各ターゲットのactual topLine を読み取り
   b. 期待値と異なる場合は再度 revealRange で補正
5. 150ms のフィードバック抑制 (reveal 起因のイベントを無視)
```

#### 4.2.2 行番号変換

```
ドキュメント行 → グローバル行:
  projectedLineMap.documentLineToGlobalRow.get(docLine)
  フォールバック: docLine そのまま

グローバル行 → ドキュメント行:
  projectedLineMap.globalRowToDocumentLine.get(globalRow)
  フォールバック (射影あり): projectedGlobalRows で二分探索
  フォールバック (射影なし): globalRow そのまま
```

#### 4.2.3 不変条件

- 同一セッション・同一ウィンドウ内のエディタのみ同期する
- `lineNumberSpace === 'globalRow'` のバインディングのみ対象
- ソースエディタ自身は同期対象外
- `syncInProgress` フラグと `suppressUntil` タイムスタンプでフィードバックループを防止
- `lastRevealByUri` キャッシュで冗長な reveal を抑制

### 4.3 未変更行の折りたたみ

#### 4.3.1 射影アルゴリズム

```
入力:
  totalRowCount: number
  changedRowNumbers: number[]        -- 可視ペアの変更行集合
  contextLineCount: number = 3       -- 変更行前後のコンテキスト行数
  minimumCollapsedRows: number = 4   -- 折りたたみ最小行数
  expandedGapKeys: Set<string>       -- 手動展開済みギャップ

出力:
  CompareProjectedRow[]              -- データ行とギャップ行の混合リスト

手順:
  1. collapseUnchanged === false → 全行をデータ行として返す
  2. changedRowNumbers の各行の前後 contextLineCount 行を preservedRows に追加
  3. 連続する非保存行を走査:
     a. 行数 < minimumCollapsedRows → データ行として展開
     b. expandedGapKeys に含まれる → データ行として展開
     c. それ以外 → ギャップ行として折りたたみ
```

#### 4.3.2 ギャップキー形式

`"startRowNumber:endRowNumber"` (例: `"15:42"`)

### 4.4 ペア射影

#### 4.4.1 ペアキー形式

`"leftRevisionIndex:rightRevisionIndex"` (例: `"0:2"`)

#### 4.4.2 アクティブペア導出

| モード | アクティブリビジョン R に対するペア選択 |
|--------|---------------------------------------|
| `adjacent` | 右隣ペア `R:R+1` を優先、なければ左隣 `R-1:R` |
| `base` | 先頭リビジョンとのペア `base:R` |
| `all` | 距離が近い順に候補をソート、左側のペアを優先 |
| `custom` | all と同じロジックだが候補は custom キーに限定 |

#### 4.4.3 ペアオーバーレイのキャッシュ

`WeakMap<NWayCompareSession, Map<string, ComparePairOverlay>>` でセッションオブジェクトにキャッシュ。隣接ペアは `session.adjacentPairs` を再利用、非隣接ペアはオンデマンド計算。

### 4.5 Blame ヒートマップ

#### 4.5.1 年齢バケット

| バケット | 範囲 | 色 (Dark テーマ) |
|---------|------|-----------------|
| 0 | 30日以内 | 緑系 |
| 1 | 31-180日 | 黄緑系 |
| 2 | 181-365日 | 黄系 |
| 3 | 1-2年 | オレンジ系 |
| 4 | 2年超 / タイムスタンプなし | 赤系 |

#### 4.5.2 表示

- ガターアイコンによる色分け
- エディタ背景のアルファブレンド
- オーバービュールーラーカラー (設定で切替可能)
- ホバーツールチップ: 著者、リビジョン、日付

### 4.6 タブ管理 (ネイティブモード)

#### 4.6.1 タブトラッキング

```
sessionTabs: Map<sessionId, SessionTabState>
  SessionTabState:
    renderGeneration: number         -- レンダリング世代番号
    trackedUriKeys: Set<string>      -- uri.toString(true) のセット

trackedUriOwners: Map<uriKey, sessionId>
  -- 逆引きマップ: URI → セッション
```

#### 4.6.2 タブ開閉フロー

```
セッション開始:
  1. EditorLayoutController.setLayout(N) でレイアウト設定
  2. 各リビジョンのドキュメントを openTextDocument → showTextDocument
  3. trackSessionTabs で URI を追跡登録

ユーザーがタブ1つを閉じた場合:
  1. onDidChangeTabs イベント発火
  2. 閉じられたタブの URI → trackedUriOwners でセッション特定
  3. internalCloseKeys で内部クローズか判定 (内部ならスキップ)
  4. closeSessionAfterUserTabClose:
     a. 残りの追跡タブをすべて closeTrackedTabs で閉じる
     b. セッションを removeSession で削除
```

#### 4.6.3 内部クローズ管理

`internalCloseKeys: Set<string>` にプログラム的クローズの `sessionId::uriKey` を登録。`onDidChangeTabs` コールバック内で検出・スキップすることで、カスケード・ループを防止する。

#### 4.6.4 URI 正規化対策

VS Code が `openTextDocument(uri)` 時に URI を正規化する可能性があるため:
- `trackSessionTabs` には `document.uri` (実際に返された URI) を使用
- バインディングの `documentUri` と実際の URI が異なる場合は追加バインディングを登録

### 4.7 Diff デコレーション

#### 4.7.1 デコレーション種別

| デコレーション | 用途 |
|--------------|------|
| ペアエッジ (左ボーダー) | 前リビジョンペアの変更行マーカー |
| ペアエッジ (右ボーダー) | 次リビジョンペアの変更行マーカー |
| アクティブペア背景 (追加) | アクティブペアの追加行ハイライト |
| アクティブペア背景 (削除) | アクティブペアの削除行ハイライト |
| アクティブペア背景 (変更) | アクティブペアの変更行ハイライト |
| 行内追加ハイライト | 単語レベルの追加部分 |
| 行内削除ハイライト | 単語レベルの削除部分 |

#### 4.7.2 使用テーマカラー

- `diffEditor.insertedLineBackground`
- `diffEditor.removedLineBackground`
- `diffEditor.insertedTextBackground`
- `diffEditor.removedTextBackground`

### 4.8 キャッシュシステム

#### 4.8.1 2階層キャッシュ

```
CacheService
  ├── MemoryCache (LRU, デフォルト 512 MB)
  └── PersistentCache (globalStorageUri 配下のファイル)
```

#### 4.8.2 読み取りフロー

```
1. MemoryCache.get(key)
   → ヒット: 値を返す
2. PersistentCache.get(key)
   → ヒット: MemoryCache にも格納して返す
3. VCS アダプタからフェッチ
   → 両キャッシュに格納して返す
```

#### 4.8.3 Blame キャッシュ TTL

- コミット済みリビジョン: TTL なし (不変)
- ワーキングツリー: `WORKTREE_BLAME_CACHE_TTL_MS = 60,000ms`

### 4.9 シャドウワークスペース

スナップショットを一時ディレクトリに実ファイルとして書き出すサービス。VS Code の言語機能 (IntelliSense, 型チェック等) が過去リビジョンのスナップショットに対して動作するために必要。

---

## 5. コマンド・UI 仕様

### 5.1 パブリックコマンド

| コマンド ID | 表示名 | 有効条件 |
|------------|--------|---------|
| `multidiff.browseRevisions` | Browse Revisions | 常時 |
| `multidiff.browseRevisionsSingleTab` | Browse Revisions (Single-Tab) | 常時 |
| `multidiff.changePairProjection` | Change Pair Projection | `multidiff.canChangePairProjection` |
| `multidiff.closeActiveSession` | Close Active Session | `multidiff.hasActiveSession` |
| `multidiff.expandAllCollapsedGaps` | Expand All Collapsed Gaps | 折りたたみ有効かつギャップあり |
| `multidiff.openActiveSessionSnapshot` | Open Active Session Snapshot | `multidiff.hasActiveSnapshot` |
| `multidiff.openActiveSessionPairDiff` | Open Active Session Pair Diff | `multidiff.hasActivePair` |
| `multidiff.shiftWindowLeft` | Shift Window Left | `multidiff.canShiftWindowLeft` |
| `multidiff.shiftWindowRight` | Shift Window Right | `multidiff.canShiftWindowRight` |
| `multidiff.resetExpandedGaps` | Reset Expanded Gaps | 折りたたみ有効かつ展開済みギャップあり |
| `multidiff.switchCompareSurface` | Switch Compare Surface | `multidiff.hasActiveSession` |
| `multidiff.toggleBlameHeatmap` | Toggle Blame Heatmap | 常時 |
| `multidiff.toggleCollapseUnchanged` | Toggle Collapse Unchanged | `multidiff.hasActiveSession` |

### 5.2 キャッシュコマンド

| コマンド ID | 表示名 |
|------------|--------|
| `multidiff.cache.warmCurrentFile` | Warm Cache for Current File |
| `multidiff.cache.clearCurrentRepo` | Clear Cache for Current Repository |
| `multidiff.cache.clearAll` | Clear All Cache |

### 5.3 内部コマンド (ツリービュー用)

`multidiff.internal.*` 系コマンドはコマンドパレットに表示されず、ツリービューのコンテキストメニューから呼び出される。機能はパブリックコマンドと同一。

### 5.4 コンテキストメニュー

#### Explorer コンテキストメニュー

- `multidiff.browseRevisions` -- ファイルスキーム (`resourceScheme == file`) の場合に `3_compare` グループに表示

#### Sessions ツリービュー コンテキストメニュー

- **インライン**: Reveal Session / Switch Compare Surface / Close Session
- **ナビゲーション**: Change Pair Projection / Open Snapshot / Open Pair Diff / Toggle Collapse / Shift Window Left・Right / Expand All Gaps / Reset Expanded Gaps

各項目は `viewItem` のスペース区切りトークンによる `when` 句で制御。

### 5.5 When 句コンテキストキー

`SessionCommandContextController` が管理するキー:

| キー | 型 | 説明 |
|------|---|------|
| `multidiff.hasActiveSession` | boolean | アクティブなセッションがあるか |
| `multidiff.canChangePairProjection` | boolean | ペア射影を変更可能か (3+リビジョン) |
| `multidiff.canShiftWindowLeft` | boolean | ウィンドウを左シフト可能か |
| `multidiff.canShiftWindowRight` | boolean | ウィンドウを右シフト可能か |
| `multidiff.hasActiveSnapshot` | boolean | アクティブなスナップショットがあるか |
| `multidiff.hasActivePair` | boolean | アクティブなペアがあるか |
| `multidiff.collapseUnchangedActive` | boolean | 折りたたみが有効か |
| `multidiff.hasCollapsedGaps` | boolean | 折りたたまれたギャップがあるか |
| `multidiff.hasExpandedGaps` | boolean | 展開済みギャップがあるか |

### 5.6 ツリービュー

#### Fukusa Sessions ツリー (`multidiff.sessions`)

- **ルートノード**: セッション (サーフェスモード・ウィンドウ情報・アクティブペア等を description に表示)
- **子ノード**: リビジョンスナップショット (ラベル・パス)

#### Fukusa Cache ツリー (`multidiff.cache`)

- **ルートノード**: リポジトリ別のキャッシュ概要 (サイズ・エントリ数)

---

## 6. データフロー仕様

### 6.1 セッション作成フロー

```
[ユーザー] "Browse Revisions" コマンド実行
    │
    ▼
[commands/browseRevisions.ts]
    │ resolveTargetResource() で対象ファイル特定
    │ browseAndOpenRevisions() 呼び出し
    │
    ▼
[application/revisionPickerService.ts]
    │ リビジョン一覧取得 → QuickPick でユーザー選択
    │
    ▼
[application/sessionBuilderService.ts] createSession()
    │ 1. 各リビジョンのスナップショットバイトを並列ロード (キャッシュ → VCS)
    │ 2. シャドウワークスペースに書き出し
    │ 3. Blame ヒートマップ取得
    │ 4. SessionAlignmentService.buildState() でアラインメント実行
    │    ├─ nWayAlignmentEngine.buildCanonicalRows()
    │    ├─ GlobalRow[] 構築
    │    ├─ RawSnapshot[] + lineMap 構築
    │    ├─ AdjacentPairOverlay[] 構築
    │    └─ IntralineDiff 計算
    │ 5. sessionService.createBrowserSession() でセッション登録
    │
    ▼
[presentation/compare/compareSurfaceCoordinator.ts] openSession()
    │ surfaceMode に応じて分岐
    │
    ├──[native]──▶ nativeCompareSessionController.openSession()
    │                │ renderSession():
    │                │  1. 既存タブクローズ
    │                │  2. SessionViewportState 計算
    │                │  3. EditorLayoutController.setLayout(N)
    │                │  4. N 個のドキュメントを open → show
    │                │  5. タブトラッキング登録
    │                │  6. EditorSyncController 設定
    │                │  7. DiffDecorationController.refresh()
    │
    └──[panel]───▶ panelCompareSessionController.openSession()
                     │ WebviewPanel 作成
                     │ HTML + CSS + JS を生成して webview にセット
                     │ ComparePanelViewModel をメッセージで送信
```

### 6.2 スクロール同期フロー

```
[ユーザー] エディタ A をスクロール
    │
    ▼
[VS Code] onDidChangeTextEditorVisibleRanges 発火
    │
    ▼
[EditorSyncController] handleVisibleRangeChange()
    │ バインディング検証 (セッション、行番号空間、ウィンドウ開始)
    │ ドキュメント行 → グローバル行変換
    │ scheduleSync() → 32ms タイマー設定
    │
    ▼ (32ms 後)
[EditorSyncController] flushPendingSync()
    │ ソースエディタの最新位置を再読み取り
    │ syncPeers():
    │   各ピアエディタに対して:
    │     グローバル行 → ドキュメント行変換
    │     editor.revealRange(targetLine, AtTop)
    │ scheduleVerify() → 80ms タイマー設定
    │
    ▼ (80ms 後)
[EditorSyncController] 検証コールバック
    │ 各ターゲットの実際の topLine を確認
    │ 期待値と異なれば再度 revealRange で補正
    │ suppressUntil = now + 150ms
```

### 6.3 タブクローズカスケードフロー

```
[ユーザー] セッションタブ B を手動で閉じる
    │
    ▼
[VS Code] onDidChangeTabs { closed: [tabB] }
    │
    ▼
[NativeCompareSessionController] handleTabChanges()
    │ tabB の URI → trackedUriOwners でセッション ID 特定
    │ internalCloseKeys に該当なし → user-initiated と判定
    │
    ▼
closeSessionAfterUserTabClose(sessionId)
    │ 1. closeTrackedTabs():
    │    a. findTrackedTabs() → 残りタブ [tabA, tabC] を発見
    │    b. internalCloseKeys に tabA, tabC のキーを登録
    │    c. tabGroups.close([tabA, tabC], true)
    │    [VS Code が onDidChangeTabs を発火 → internalCloseKeys で検出・スキップ]
    │    d. internalCloseKeys をクリア
    │ 2. unregisterSessionTabs()
    │ 3. sessionService.removeSession()
```

### 6.4 表示モード切替フロー

```
[ユーザー] Switch Compare Surface コマンド
    │
    ▼
[CompareSurfaceCoordinator] switchActiveSurface()
    │ 1. getCurrentController(session).closeSessionSurface()
    │ 2. sessionService.updateSurfaceMode(newMode)
    │ 3. getController(newMode).openSession(session)
```

### 6.5 ウィンドウシフトフロー

```
[ユーザー] Shift Window Right コマンド
    │
    ▼
[NativeCompareSessionController] shiftSessionWindow(sessionId, delta=+1)
    │ 1. captureTopVisibleGlobalRow() → 現在のスクロール位置を記憶
    │ 2. closeTrackedTabs() → 既存タブ全クローズ
    │ 3. sessionService.shiftWindow(delta) → ビューステート更新
    │ 4. renderSession(session, { restoreTopGlobalRow }) → 新ウィンドウで再レンダリング
    │    → restoreTopGlobalRow で元のスクロール位置を復元
```

---

## 7. 既知の課題・将来計画

### 7.1 既知の課題

| # | カテゴリ | 説明 | ファイル |
|---|--------|------|---------|
| 1 | スクロール同期 | `revealRange(AtTop)` は VS Code の API 仕様上、ピクセル単位の精度を保証しない。検証パスで補正するが、高速スクロール時にわずかなズレが残る可能性がある | `editorSyncController.ts` |
| 2 | タブカスケード | VS Code がドキュメント URI を正規化した場合、追跡 URI が不一致となりカスケードクローズが失敗する。正規化対策を追加したが、全パターンをカバーしているかは未検証 | `nativeCompareSessionController.ts` |
| 3 | パフォーマンス | N-Way アラインメントは計算量が大きく、大規模ファイル (10,000行+) やリビジョン数が多い場合 (10+) にセッション作成が遅延する可能性がある | `nWayAlignmentEngine.ts` |
| 4 | メモリ | `GlobalRow[]` はすべてのセルテキストをメモリに保持する。大規模ファイル×多リビジョンでメモリ消費が大きくなる | `types.ts` |
| 5 | SVN 対応 | SVN アダプタは CLI 依存であり、認証ダイアログのハンドリングが限定的 | `svnAdapter.ts` |

### 7.2 改善候補

| # | カテゴリ | 提案 | 優先度 |
|---|--------|------|--------|
| 1 | UX | ミニマップ/スクロールバーの同期 (VS Code API の制約あり、カスタム Webview の検討) | 中 |
| 2 | パフォーマンス | アラインメント結果のインクリメンタル更新 (ウィンドウシフト時の再計算回避) | 中 |
| 3 | 機能 | ディレクトリ単位の N-Way 比較 | 低 |
| 4 | 機能 | マージコンフリクト解消の支援 | 低 |
| 5 | UX | パネルモードでの検索/フィルタリング | 中 |
| 6 | インフラ | Persistent Cache の自動ガベージコレクション | 低 |
| 7 | テスト | 統合テストの充実 (実際の Git リポジトリを使用したE2Eテスト) | 高 |
| 8 | UX | カスタムキーバインディングの提供 | 低 |

---

## 付録 A: 定数一覧

| 定数 | 値 | 定義場所 |
|------|---|---------|
| `MAX_VISIBLE_REVISIONS` | `9` | `sessionViewport.ts` |
| `MATCH_SIMILARITY_THRESHOLD` | `0.3` | `nWayAlignmentEngine.ts` |
| `MATCH_LOOKAHEAD` | `6` | `nWayAlignmentEngine.ts` |
| `MAX_ALIGNMENT_MATRIX_CELLS` | `1,500,000` | `nWayAlignmentEngine.ts` |
| `DEFAULT_CONTEXT_LINE_COUNT` | `3` | `compareRowProjection.ts` |
| `DEFAULT_MINIMUM_COLLAPSED_ROWS` | `4` | `compareRowProjection.ts` |
| `WORKTREE_BLAME_CACHE_TTL_MS` | `60,000` | `blameService.ts` |
| スクロールデバウンス | `32ms` | `editorSyncController.ts` |
| スクロール検証遅延 | `80ms` | `editorSyncController.ts` |
| フィードバック抑制 | `150ms` | `editorSyncController.ts` |
| セッション上限 | `20` | `sessionService.ts` |
| メモリキャッシュデフォルト | `512 MiB` | `package.json` |

## 付録 B: イベントフロー

```
SessionService のイベント:
  onDidChangeSessions          → SessionsTreeProvider.refresh()
                               → NativeCompareSessionController.handleSessionsChange()
                               → SessionCommandContextController (コンテキストキー更新)

  onDidChangeSessionViewState  → NativeCompareSessionController.handleSessionViewStateChange()
                               → PanelCompareSessionController (パネル再描画)
                               → SessionsTreeProvider.refresh()
                               → SessionCommandContextController (コンテキストキー更新)

  onDidChangeSessionProjection → NativeCompareSessionController.handleSessionProjectionChange()
                               → PanelCompareSessionController (パネル再描画)
                               → SessionsTreeProvider.refresh()
                               → SessionCommandContextController (コンテキストキー更新)

  onDidChangeSessionPresentation → SessionsTreeProvider.refresh()
                                 → SessionCommandContextController (コンテキストキー更新)
```

## 付録 C: ファイルマップ

```
src/
├── extension.ts                           -- エントリポイント・DI 配線
├── adapters/
│   ├── common/
│   │   ├── types.ts                       -- 全ドメイン型定義
│   │   └── repositoryAdapter.ts           -- VCS アダプタインターフェース
│   ├── git/
│   │   ├── gitAdapter.ts                  -- Git アダプタ実装
│   │   ├── gitApi.ts                      -- VS Code Git Extension API ラッパー
│   │   └── gitCli.ts                      -- Git CLI ラッパー
│   └── svn/
│       ├── svnAdapter.ts                  -- SVN アダプタ実装
│       └── svnCli.ts                      -- SVN CLI ラッパー
├── application/
│   ├── blameService.ts                    -- Blame ヒートマップサービス
│   ├── cacheService.ts                    -- 2階層キャッシュファサード
│   ├── comparePairing.ts                  -- ペア射影ロジック
│   ├── compareRowProjection.ts            -- 行折りたたみ射影
│   ├── languageFeatureCompatibilityService.ts  -- 言語機能互換性
│   ├── nWayAlignmentEngine.ts             -- N-Way アラインメントコアアルゴリズム
│   ├── repositoryRegistry.ts              -- リポジトリ登録
│   ├── repositoryService.ts               -- リポジトリサービス
│   ├── revisionPickerService.ts           -- リビジョン選択 UI
│   ├── sessionAlignmentService.ts         -- セッションアラインメントオーケストレーター
│   ├── sessionBuilderService.ts           -- セッション構築サービス
│   ├── sessionCapabilities.ts             -- UI ケイパビリティ判定
│   ├── sessionRowProjection.ts            -- セッション行射影
│   ├── sessionService.ts                  -- セッション状態管理 (中央)
│   └── sessionViewport.ts                 -- ビューポート計算
├── commands/
│   ├── browseRevisions.ts                 -- Browse Revisions コマンド
│   ├── browseRevisionsSingleTab.ts        -- Browse Revisions (Single-Tab)
│   ├── changePairProjection.ts            -- ペア射影変更
│   ├── clearCache.ts                      -- キャッシュクリア
│   ├── closeActiveSession.ts              -- セッションクローズ
│   ├── commandContext.ts                  -- コマンドコンテキスト (DI バッグ)
│   ├── expandAllCollapsedGaps.ts          -- 全ギャップ展開
│   ├── openActiveSessionPairDiff.ts       -- ペア diff を開く
│   ├── openActiveSessionSnapshot.ts       -- スナップショットを開く
│   ├── openForCurrentFile.ts              -- 現在のファイルで開く
│   ├── openForExplorerFile.ts             -- エクスプローラーから開く
│   ├── openRevisionSnapshot.ts            -- リビジョンスナップショットを開く
│   ├── openSessionAdjacent.ts             -- 隣接ペアで開く
│   ├── openSessionBase.ts                 -- ベースペアで開く
│   ├── openSnapshotAsTempFile.ts          -- スナップショットを一時ファイルで開く
│   ├── pairProjectionPicker.ts            -- ペア射影選択 UI
│   ├── resetExpandedGaps.ts               -- ギャップリセット
│   ├── revealSession.ts                   -- セッション表示
│   ├── sessionCommandContextController.ts -- when 句コンテキストキー管理
│   ├── shared.ts                          -- 共有ユーティリティ
│   ├── shiftWindowLeft.ts                 -- ウィンドウ左シフト
│   ├── shiftWindowRight.ts                -- ウィンドウ右シフト
│   ├── switchCompareSurface.ts            -- サーフェス切替
│   ├── toggleBlameHeatmap.ts              -- Blame 切替
│   ├── toggleCollapseUnchanged.ts         -- 折りたたみ切替
│   └── warmCache.ts                       -- キャッシュウォーム
├── infrastructure/
│   ├── cache/
│   │   ├── memoryCache.ts                 -- LRU メモリキャッシュ
│   │   └── persistentCache.ts             -- 永続キャッシュ
│   ├── fs/
│   │   ├── alignedSessionDocumentProvider.ts  -- 仮想ドキュメントプロバイダ
│   │   ├── languageModeResolver.ts        -- 言語モード解決
│   │   ├── snapshotFsProvider.ts          -- ReadOnly ファイルシステムプロバイダ
│   │   └── uriFactory.ts                 -- URI ファクトリ
│   ├── shadow/
│   │   └── shadowWorkspaceService.ts      -- シャドウワークスペース
│   └── temp/
│       └── tempSnapshotMirror.ts          -- 一時ファイルミラー
├── presentation/
│   ├── compare/
│   │   ├── comparePanelDocument.ts        -- パネル viewmodel 構築
│   │   ├── compareSurfaceCoordinator.ts   -- サーフェス切替コーディネーター
│   │   └── panelCompareSessionController.ts -- Webview パネルコントローラー
│   ├── decorations/
│   │   └── blameDecorationController.ts   -- Blame デコレーション
│   ├── native/
│   │   ├── diffDecorationController.ts    -- Diff デコレーション
│   │   ├── editorLayoutController.ts      -- エディタレイアウト
│   │   ├── editorSyncController.ts        -- スクロール同期
│   │   └── nativeCompareSessionController.ts -- ネイティブエディタ管理
│   └── views/
│       ├── cacheTreeProvider.ts           -- キャッシュツリー
│       └── sessionsTreeProvider.ts        -- セッションツリー
└── util/
    └── output.ts                          -- 出力ログ
```
