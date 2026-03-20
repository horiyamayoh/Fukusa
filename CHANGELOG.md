# 変更履歴

このファイルには Fukusa の主な変更を記録します。

## 0.0.1

初回 pre-release。

### 初期実装 (3d67ac7)

- `multidiff:` 仮想ファイルシステムによる readonly historical snapshot 表示を追加
- native diff editor を使った 2 revision 比較を追加
- adjacent / base モードの Fukusa session を追加
- window shift による可視 pair の切り替えを追加
- blame heatmap の decoration / overview ruler / hover 表示を追加
- snapshot / history / blame の memory cache / persistent cache を追加
- Git / SVN 両対応の repository adapter を追加
- `tempFile` ベースの compatibility fallback を追加
- unit test / integration test / VSIX packaging の検証フローを追加

### キャッシュ改善 (11f9446)

- snapshot キャッシュの検証ロジックを改善

### プロジェクト名変更 (4c5ea79)

- MultiDiffViewer から Fukusa にリネーム

### ネイティブエディタファースト (ba56fb7)

- compare surface をネイティブエディタに統一
- aligned synthetic session document (`multidiff-session-doc://`) モデルを導入

### アライン済みネイティブセッション (539c636)

- N-way alignment engine (`nWayAlignmentEngine.ts`) を導入
- weighted monotonic line matching による replacement hunk 精度向上
- `SessionService` をイベント駆動モデルに再設計
- `NWayCompareSession` を不変モデル、`SessionViewState` を可変ビューステートに分離
- スクロール同期 (`EditorSyncController`) の debounce / verify / feedback suppression 実装
- diff decoration (border, background, intraline) を追加

### パネルサーフェス・セッション射影 (4c0cbda)

- single-tab compare panel (`PanelCompareSessionController`) を本番導入
- `CompareSurfaceCoordinator` によるネイティブ/パネル切替
- pair projection モデル (adjacent / base / all / custom) を導入
- row projection layer (未変更行折りたたみ) を導入
- `sessionViewport.ts` でビューポート計算を一元化
- `Browse Revisions (Single-Tab)` コマンドを追加
- `Change Pair Projection`, `Switch Compare Surface` コマンドを追加
- `Expand All Collapsed Gaps`, `Reset Expanded Gaps` コマンドを追加
- sessions tree にセッションアクション (reveal, switch, close) を追加

### 仕様書追加 (d819c16)

- `docs/SPEC.md` にコードベースから逆引きした包括的仕様書を追加

### スクロール同期修正 (c570178)

- VS Code sticky scroll のパディング補正を追加し、スクロール同期の精度を改善
