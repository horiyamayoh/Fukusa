# N-Way Parity Audit

Updated: 2026-03-20

## 現在の結論

- Fukusa は「基本機能が存在する」段階は超えているが、VS Code native 2-way diff UX を厳密に拡張できているとはまだ言えない。
- 現在の重み付き parity score は `31.5 / 93 = 33.9%`。基盤層は強いが、native surface の完成度が全体を強く引き下げている。
- 最大のギャップは `N03/N04` の空側意味論、`N06` の diff editor 固有 affordance、`N08/N09` の scroll API 制約、`N14` の compare 文書上 language feature 欠落、そして `R01/R02` の実機証拠未収集。
- 自動テストは強い。2026-03-20 時点で `npm run compile`、`npm run test:unit`、`npm run test:integration` は通過したが、desktop screenshot / video 証拠はまだ無い。

### 今回の改訂で変えたこと

- スコア集計を再計算し、前版の算術不整合を修正した。
- `Parity Status` と `Evidence Level` を分離し、未確認・実装不足・API 制約が同じ `0.0` に潰れないようにした。
- 監査メタデータ、Top blockers、証拠回収計画を追加した。
- `N13` と `N14` を追加し、syntax highlighting と language feature compatibility の parity 欠落を明示した。
- 本文の説明調を日本語主体に揃えた。

## Audit Metadata

| 項目 | 値 |
| --- | --- |
| Audit date | `2026-03-20` |
| Commit | `f6d43c627ed0110f1c05287d14cbbd17cdf4b316` |
| Branch | `native-editor-first-compare` |
| Working tree at evidence collection | `clean` |
| OS | `Microsoft Windows NT 10.0.26220.0` |
| Shell | `PowerShell 5.1.26100.7961` |
| Node.js | `v22.13.1` |
| VS Code test host | `1.96.0` |
| Primary surface under audit | `native` |
| Secondary surface under audit | `panel` |
| Desktop visual pass | `not executed in this revision` |
| Theme / font / zoom / sticky scroll metadata | `not captured yet; future evidence must attach a manifest` |

## 監査基準

### Acceptance Bar

- 受け入れ基準は VS Code native 2-way diff UX であり、既存 docs の `best-effort` 表現ではない。
- 主評価面は `native`、副評価面は `panel`。
- `panel` は shared-model consistency check と single-scroll escape hatch として評価する。
- `platform-limit` は「現行 public API と現行アーキテクチャでは達成不能」の場合だけに使う。

### Parity Status

| 状態 | 意味 | スコア係数 |
| --- | --- | --- |
| `match` | 現在の証拠で基準挙動に達している | `1.0` |
| `partial` | 一部成立しているが、意味論・UX・証拠のいずれかが不足 | `0.5` |
| `mismatch` | 現在の挙動が基準と明確にずれている | `0.0` |
| `missing` | 必要な挙動が実装されていない | `0.0` |
| `platform-limit` | public API 制約により現行構成では達成不能 | `0.0` |
| `unknown` | 実機証拠不足で判定を閉じられない | `0.0` |

### Evidence Level

| レベル | 意味 |
| --- | --- |
| `visual` | desktop screenshot / video と観察メモが付いている |
| `test` | 挙動を直接支える automated test がある |
| `code` | 実装確認のみ。専用テストや実機証拠は未添付 |
| `api-limit` | 公式 API 制約と実装確認の両方で現状限界が示せる |
| `none` | 直接証拠がまだ無い |

### 集計ルール

- `weighted score = sum(weight * statusFactor) / sum(weight)`
- 重みは `critical=5`, `major=3`, `minor=1`
- スコアは parity の近さを測るものであり、テスト件数やコード量の代理指標ではない
- `Evidence Level` はスコアに加点しない。証拠の強さを別軸で追跡する

### 参照ルール

- implementation と今回の実行結果を最優先の事実源とする
- `SPEC.md` と `USER_GUIDE.md` は current claim、ADR 群は design intent として扱う
- 歴史資料と将来構想は現状完成度の証拠に使わない
- 未来の screenshot は `docs/audit-evidence/YYYY-MM-DD/` に保存し、同ディレクトリへ `manifest.md` を置く
- `manifest.md` には OS、VS Code version、theme、font、zoom、sticky scroll、surface、fixture repo / revision を必ず書く

### 近接ドキュメントとの衝突

- [SPEC.md](./SPEC.md) と [USER_GUIDE.md](./USER_GUIDE.md) は native scroll sync を `best-effort` と認めているが、本監査はそれを acceptance bar に採用しない
- [adr_001_native_editor_first_compare_surface.md](./adr_001_native_editor_first_compare_surface.md) は syntax highlighting と language features 維持を decision に含めるが、現行 compare 文書はそこにまだ到達していない
- [Fukusa_nway_redesign_plan_2026-03-15.md](./Fukusa_nway_redesign_plan_2026-03-15.md) と [archive/Fukusa_design_v0.2.md](./archive/Fukusa_design_v0.2.md) は historical / future intent であり、現状証拠には使わない

## スコアカード

| 領域 | 含む行 | 獲得点 / 満点 | 進捗率 | コメント |
| --- | --- | --- | --- | --- |
| Foundational model and command surface | `F01-F07` | `13.0 / 19` | `68.4%` | モデル、コマンド、repo access はかなり揃っている |
| Native parity surface | `N01-N14` | `17.0 / 58` | `29.3%` | strict parity を阻むギャップが最も集中している |
| Panel alternative surface | `P01-P02` | `1.5 / 6` | `25.0%` | single-scroll は強いが、diff semantics の見せ方は弱い |
| End-to-end visual proof | `R01-R02` | `0.0 / 10` | `0.0%` | 実機証拠が未収集 |
| **Overall** | **`F01-F07, N01-N14, P01-P02, R01-R02`** | **`31.5 / 93`** | **`33.9%`** | **まだ strict parity には遠い** |

注記:

- 前版の集計値 `29.5 / 84` は算術的に閉じていなかった。既存行だけでも `30.0 / 87` が正しい。
- 今回は `N13` と `N14` を追加したため、最新版の総計は `31.5 / 93` になっている。

## Top Blocking Findings

| 優先度 | 種別 | 関連行 | ブロッカー | 直近アクション |
| --- | --- | --- | --- | --- |
| `P0` | `implementation` | `N03`, `N04` | 空側背景と空側行番号が native diff の最小意味論を満たしていない | empty-side 専用表現を設計するか、gutter を捨てた別 surface 方針を決める |
| `P0` | `decision` | `N06`, `N08`, `N09` | main surface を native `TextEditor` のまま strict parity で維持できるかが未決着 | native 継続か panel 主面化か、受け入れる妥協点を明文化する |
| `P0` | `semantics` | `N02` | `base / all / custom` の non-adjacent overlay が direct pair diff と同義か未証明 | `vscode.diff` との差分監査を scenario 化して閉じる |
| `P1` | `compatibility` | `N13`, `N14` | native-editor-first の価値だった syntax / hover / definition / references が compare 文書で未達 | language mode の coverage を拡張し、bridge を実装して register するか、明示的に de-scope する |
| `P1` | `validation` | `R01`, `R02` | parity-critical 項目の大半が desktop rendering 依存で、実機証拠がまだ無い | fixture repo と evidence manifest を作り、定期監査に載せる |
| `P1` | `usability` | `N11`, `P02` | 10+ revision continuity と panel row numbering が長文書運用で不安定 | 先に実機監査を取り、仕様と UI policy を固定する |

## 監査マトリクス

### Foundational

| ID | 判定 | 証拠 | 重要度 | 要点 | 主証拠 | 次アクション |
| --- | --- | --- | --- | --- | --- | --- |
| `F01` | `match` | `test` | `major` | session build、revision 順序、初期 pair projection は安定している | [sessionBuilderService.ts](../src/application/sessionBuilderService.ts), [browseRevisions.ts](../src/commands/browseRevisions.ts), [sessionBuilderService.test.ts](../src/test/unit/sessionBuilderService.test.ts), [openDiffSelection.test.ts](../src/test/unit/openDiffSelection.test.ts) | Git/SVN picker の実機 UX を収録する |
| `F02` | `match` | `test` | `major` | `adjacent / base / all / custom` の正規化と command surface は成立している | [comparePairing.ts](../src/application/comparePairing.ts), [changePairProjection.ts](../src/commands/changePairProjection.ts), [comparePairing.test.ts](../src/test/unit/comparePairing.test.ts), [changePairProjection.test.ts](../src/test/unit/changePairProjection.test.ts) | custom pair 再選択の実機証拠を取る |
| `F03` | `partial` | `test` | `major` | active pair は導出できるが、色の意味が focus と visible window に依存する | [sessionViewport.ts](../src/application/sessionViewport.ts), [sessionCapabilities.ts](../src/application/sessionCapabilities.ts), [sessionViewport.test.ts](../src/test/unit/sessionViewport.test.ts), [sessionService.test.ts](../src/test/unit/sessionService.test.ts) | UI 文言込みで active pair 規約を固定する |
| `F04` | `partial` | `test` | `major` | snapshot / pair diff の escape hatch はあるが、往復時の実機 UX は未証明 | [openActiveSessionSnapshot.ts](../src/commands/openActiveSessionSnapshot.ts), [openActiveSessionPairDiff.ts](../src/commands/openActiveSessionPairDiff.ts), [openActiveSessionSnapshot.test.ts](../src/test/unit/openActiveSessionSnapshot.test.ts), [openActiveSessionPairDiff.test.ts](../src/test/unit/openActiveSessionPairDiff.test.ts) | focus return と tab behavior を実機確認する |
| `F05` | `match` | `test` | `minor` | Sessions tree と context keys は session 状態と整合している | [sessionCommandContextController.ts](../src/commands/sessionCommandContextController.ts), [sessionsTreeProvider.ts](../src/presentation/views/sessionsTreeProvider.ts), [sessionCommandContextController.test.ts](../src/test/unit/sessionCommandContextController.test.ts), [sessionsTreeProvider.test.ts](../src/test/unit/sessionsTreeProvider.test.ts) | menu surfacing の screenshot を 1 回残す |
| `F06` | `partial` | `test` | `major` | Git adapter は history / snapshot / blame を実 repo から取得できるが、viewer parity 自体は別問題 | [gitAdapter.ts](../src/adapters/git/gitAdapter.ts), [gitCli.ts](../src/adapters/git/gitCli.ts), [gitAdapter.test.ts](../src/test/integration/gitAdapter.test.ts) | Git visual parity scenarios に接続する |
| `F07` | `partial` | `test` | `major` | SVN adapter も同様に基盤は成立しているが、viewer parity は未証明 | [svnAdapter.ts](../src/adapters/svn/svnAdapter.ts), [svnCli.ts](../src/adapters/svn/svnCli.ts), [svnAdapter.test.ts](../src/test/integration/svnAdapter.test.ts) | SVN visual parity scenarios に接続する |

### Native Surface

| ID | 判定 | 証拠 | 重要度 | 要点 | 主証拠 | 次アクション |
| --- | --- | --- | --- | --- | --- | --- |
| `N01` | `partial` | `test` | `critical` | alignment core は強いが、曖昧ケースの parity はまだ限定証拠しかない | [nWayAlignmentEngine.ts](../src/application/nWayAlignmentEngine.ts), [sessionAlignmentService.ts](../src/application/sessionAlignmentService.ts), [nWayAlignmentEngine.core.test.ts](../src/test/unit/nWayAlignmentEngine.core.test.ts), [sessionAlignmentService.test.ts](../src/test/unit/sessionAlignmentService.test.ts) | repeated lines / reorder を実 repo で監査する |
| `N02` | `partial` | `test` | `critical` | non-adjacent overlay は direct pair diff ではなく shared `globalRows` 比較なので、完全一致保証がない | [comparePairing.ts](../src/application/comparePairing.ts), [compareRowDisplayState.ts](../src/application/compareRowDisplayState.ts), [comparePairing.test.ts](../src/test/unit/comparePairing.test.ts), [compareRowDisplayState.test.ts](../src/test/unit/compareRowDisplayState.test.ts) | `vscode.diff` との差分監査を追加する |
| `N03` | `mismatch` | `test` | `critical` | absent cell は空文字行として描画され、native diff の空側背景にならない | [alignedSessionDocumentProvider.ts](../src/infrastructure/fs/alignedSessionDocumentProvider.ts), [diffDecorationController.ts](../src/presentation/native/diffDecorationController.ts), [alignedSessionDocumentProvider.test.ts](../src/test/unit/alignedSessionDocumentProvider.test.ts), [diffDecorationController.test.ts](../src/test/unit/diffDecorationController.test.ts) | empty-side 専用 decoration か surface redesign を設計する |
| `N04` | `platform-limit` | `api-limit` | `critical` | `lineNumberSpace: 'globalRow'` 固定のままでは、空側行だけ行番号を消す public API が無い | [nativeCompareSessionController.ts](../src/presentation/native/nativeCompareSessionController.ts), [alignedSessionDocumentProvider.ts](../src/infrastructure/fs/alignedSessionDocumentProvider.ts), [types.ts](../src/adapters/common/types.ts), [VS Code API: TextEditorOptions](https://code.visualstudio.com/api/references/vscode-api#TextEditorOptions) | gutter 方針を再設計する |
| `N05` | `partial` | `test` | `major` | active pair の行背景と intraline は出るが、visible pair 全体で native diff と同じ認知支援にはならない | [compareRowDisplayState.ts](../src/application/compareRowDisplayState.ts), [diffDecorationController.ts](../src/presentation/native/diffDecorationController.ts), [diffDecorationController.test.ts](../src/test/unit/diffDecorationController.test.ts) | active pair 以外の見え方を仕様化する |
| `N06` | `mismatch` | `code` | `critical` | main surface は `showTextDocument` + decorations であり、`vscode.diff` 固有 affordance は escape hatch に退避している | [nativeCompareSessionController.ts](../src/presentation/native/nativeCompareSessionController.ts), [openActiveSessionPairDiff.ts](../src/commands/openActiveSessionPairDiff.ts), [diffDecorationController.ts](../src/presentation/native/diffDecorationController.ts) | parity 対象を再定義するか surface を変える |
| `N07` | `match` | `test` | `major` | `Ctrl+Up/Down` の aligned scroll は強くカバーされている | [scrollAligned.ts](../src/commands/scrollAligned.ts), [editorSyncController.ts](../src/presentation/native/editorSyncController.ts), [scrollAlignedCommands.test.ts](../src/test/unit/scrollAlignedCommands.test.ts), [editorSyncController.test.ts](../src/test/unit/editorSyncController.test.ts) | sticky scroll on/off の実機証拠を追加する |
| `N08` | `platform-limit` | `api-limit` | `critical` | pointer-driven scroll は `visibleRanges` と `revealRange()` ベースの best-effort 実装に留まる | [editorSyncController.ts](../src/presentation/native/editorSyncController.ts), [SPEC.md](./SPEC.md), [USER_GUIDE.md](./USER_GUIDE.md), [VS Code API: TextEditor](https://code.visualstudio.com/api/references/vscode-api#TextEditor) | strict parity を native に残すか判断する |
| `N09` | `platform-limit` | `api-limit` | `critical` | public `TextEditor` API から horizontal scroll state を扱えない | [adr_003_single_tab_compare_surface.md](./adr_003_single_tab_compare_surface.md), [adr_006_single_tab_panel_surface.md](./adr_006_single_tab_panel_surface.md), [VS Code API: TextEditor](https://code.visualstudio.com/api/references/vscode-api#TextEditor) | horizontal parity のスコープを決める |
| `N10` | `partial` | `test` | `major` | collapse / expand / reset はあるが、all-gap case では native compare 文書が空になり文脈復元が弱い | [compareRowProjection.ts](../src/application/compareRowProjection.ts), [sessionRowProjection.ts](../src/application/sessionRowProjection.ts), [alignedSessionDocumentProvider.test.ts](../src/test/unit/alignedSessionDocumentProvider.test.ts), [toggleCollapseUnchanged.test.ts](../src/test/unit/toggleCollapseUnchanged.test.ts) | all-gap / context semantics を仕様化する |
| `N11` | `partial` | `test` | `critical` | top global row 復元と window shift ロジックはあるが、tab close/open を伴う視覚 continuity は未証明 | [nativeCompareSessionController.ts](../src/presentation/native/nativeCompareSessionController.ts), [sessionViewport.ts](../src/application/sessionViewport.ts), [nativeCompareSessionController.test.ts](../src/test/unit/nativeCompareSessionController.test.ts), [sessionService.test.ts](../src/test/unit/sessionService.test.ts) | 10+ revision 実機ケースを最優先で撮る |
| `N12` | `partial` | `test` | `major` | native/panel 切替の shared session state はロジック上維持されるが、visual drift は未監査 | [compareSurfaceCoordinator.ts](../src/presentation/compare/compareSurfaceCoordinator.ts), [panelCompareSessionController.ts](../src/presentation/compare/panelCompareSessionController.ts), [compareSurfaceCoordinator.test.ts](../src/test/unit/compareSurfaceCoordinator.test.ts), [panelCompareSessionController.test.ts](../src/test/unit/panelCompareSessionController.test.ts) | same-session の before/after 証拠を追加する |
| `N13` | `partial` | `code` | `major` | compare 文書は拡張子ベース静的マッピングで language id を補正するが、未対応拡張子や user association を拾わず、専用テストも無い | [languageModeResolver.ts](../src/infrastructure/fs/languageModeResolver.ts), [extension.ts](../src/extension.ts), [adr_001_native_editor_first_compare_surface.md](./adr_001_native_editor_first_compare_surface.md) | language resolution coverage を広げ、テストを追加する |
| `N14` | `missing` | `code` | `major` | compare 文書上の hover / definition / references bridge は未登録で、fallback も `undefined` を返す | [languageFeatureCompatibilityService.ts](../src/application/languageFeatureCompatibilityService.ts), [definitionBridgeProvider.ts](../src/compatibility/definitionBridgeProvider.ts), [hoverBridgeProvider.ts](../src/compatibility/hoverBridgeProvider.ts), [referenceBridgeProvider.ts](../src/compatibility/referenceBridgeProvider.ts), [extension.ts](../src/extension.ts) | provider registration と bridge 実装を行うか、明示的に de-scope する |

### Panel Surface

| ID | 判定 | 証拠 | 重要度 | 要点 | 主証拠 | 次アクション |
| --- | --- | --- | --- | --- | --- | --- |
| `P01` | `partial` | `test` | `major` | panel は単一 scroll container を持つが、実機視覚証拠は未添付 | [panelCompareSessionController.ts](../src/presentation/compare/panelCompareSessionController.ts), [comparePanelDocument.ts](../src/presentation/compare/comparePanelDocument.ts), [panelCompareSessionController.test.ts](../src/test/unit/panelCompareSessionController.test.ts) | single-scroll の動画か screenshot を追加する |
| `P02` | `mismatch` | `code` | `major` | global row gutter しか無く、per-column original line number semantics が diff 画面として読みづらい | [comparePanelDocument.ts](../src/presentation/compare/comparePanelDocument.ts), [panelCompareSessionController.ts](../src/presentation/compare/panelCompareSessionController.ts) | panel 専用の row numbering policy を決める |

### End-to-End Proof

| ID | 判定 | 証拠 | 重要度 | 要点 | 主証拠 | 次アクション |
| --- | --- | --- | --- | --- | --- | --- |
| `R01` | `unknown` | `none` | `critical` | Git parity は automated evidence まで。desktop visual proof が未添付 | [gitAdapter.test.ts](../src/test/integration/gitAdapter.test.ts), [USER_GUIDE.md](./USER_GUIDE.md), [SPEC.md](./SPEC.md) | Git fixture で screenshot / video を回収する |
| `R02` | `unknown` | `none` | `critical` | SVN parity も同様に実機証拠が無い | [svnAdapter.test.ts](../src/test/integration/svnAdapter.test.ts), [USER_GUIDE.md](./USER_GUIDE.md), [SPEC.md](./SPEC.md) | SVN fixture で screenshot / video を回収する |

## 自動テスト実行

| コマンド | 結果 | 補足 |
| --- | --- | --- |
| `npm run compile` | `pass` | TypeScript compile succeeded |
| `npm run test:unit` | `pass` | `172 passing` |
| `npm run test:integration` | `pass` | `3 passing` (`GitAdapter`, `SnapshotFsProvider`, `SvnAdapter`) |

補足:

- unit / integration とも VS Code test host `1.96.0` で実行した
- `N13`, `N14`, `N06`, `P02` を直接閉じる targeted automated test は現時点で見当たらない
- `green tests != parity achieved` は依然として成り立つ。rendering-critical 項目の多くは desktop host の視覚確認が必要

## 実機証拠回収計画

| Scenario | Covers | Artifact path | Environment | Pass rubric |
| --- | --- | --- | --- | --- |
| `M01` | `N03`, `N04`, `N05`, `R01` | `docs/audit-evidence/2026-03-20/M01-added-side.png` | `native`, 3 revisions, sticky scroll `off` | absent side 背景と行番号が `vscode.diff` と同義に見える |
| `M02` | `N03`, `N04`, `N05`, `R01` | `docs/audit-evidence/2026-03-20/M02-deleted-side.png` | `native`, 3 revisions, sticky scroll `off` | 削除の逆パターンでも空側意味論が崩れない |
| `M03` | `N01`, `N05`, `R01` | `docs/audit-evidence/2026-03-20/M03-whitespace.png` | `native`, whitespace-only fixture | modified / intraline semantics が pair diff と矛盾しない |
| `M04` | `F02`, `F03`, `N02`, `R01` | `docs/audit-evidence/2026-03-20/M04-projection-switch.png` | `native`, 4 revisions, `adjacent/base/all/custom` | 同じ row の意味変化を説明可能で、direct pair diff と矛盾が無い |
| `M05` | `N11`, `R01` | `docs/audit-evidence/2026-03-20/M05-window-shift.mp4` | `native`, 10+ revisions | shift 後も top-row continuity と focus が破綻しない |
| `M06` | `N07`, `N08`, `N09`, `R01` | `docs/audit-evidence/2026-03-20/M06-scroll-inputs.mp4` | `native`, sticky scroll `off` then `on` | keyboard / wheel / trackpad / scrollbar で peers が視覚的に揃う |
| `M07` | `N10`, `N12`, `P01`, `R01` | `docs/audit-evidence/2026-03-20/M07-collapse-surface-switch.png` | `native` and `panel` | collapse / expand / reset / surface switch で session state が壊れない |
| `M08` | `P01`, `P02`, `R01` | `docs/audit-evidence/2026-03-20/M08-panel-row-numbers.png` | `panel`, 3+ revisions | global row gutter が誤解なく読めるか、誤読点があるかを記録する |
| `M09` | `N13`, `N14`, `R01` | `docs/audit-evidence/2026-03-20/M09-language-features.md` | `native`, compare document + same file raw snapshot | syntax highlight と hover / definition / references の実挙動を明記する |
| `M10` | `F07`, `R02` | `docs/audit-evidence/2026-03-20/M10-svn-parity.png` | `SVN`, `M01-M04` 相当 | Git と同じ観点で parity を比較できる |

## API / Architecture Constraints

| ID | 制約 | 根拠 | 現在の影響 | 現在のスタンス |
| --- | --- | --- | --- | --- |
| `APC01` | `TextEditor.visibleRanges` は vertical range のみを表し、horizontal scroll state を提供しない | [VS Code API: TextEditor](https://code.visualstudio.com/api/references/vscode-api#TextEditor) | `N09` の strict parity は native では閉じない | panel へ逃がすか、strict scope を見直す |
| `APC02` | `TextEditor.revealRange()` は reveal API であり、pixel-precise multi-editor sync API ではない | [VS Code API: TextEditor](https://code.visualstudio.com/api/references/vscode-api#TextEditor), [SPEC.md](./SPEC.md), [USER_GUIDE.md](./USER_GUIDE.md) | `N08` は best-effort 実装から抜けにくい | `platform-limit` 扱いを維持 |
| `APC03` | `TextEditorOptions.lineNumbers` は editor-wide option であり、空側行だけ非表示にする public API が無い | [VS Code API: TextEditorOptions](https://code.visualstudio.com/api/references/vscode-api#TextEditorOptions) | `N04` が詰まる | gutter 再設計が必要 |
| `APC04` | main native surface は `vscode.diff` ではなく `showTextDocument` + decorations | [nativeCompareSessionController.ts](../src/presentation/native/nativeCompareSessionController.ts), [openActiveSessionPairDiff.ts](../src/commands/openActiveSessionPairDiff.ts) | built-in diff affordances は main path に自動で乗らない | `N06` は小修正では解けない |

## 現時点の監査結論

- codebase は prototype-zero ではない。session model、pair projection、row projection、surface switch、Git/SVN access は既に実用段階に入っている。
- ただし strict parity の主要阻害要因は repository access ではなく native surface の rendering contract である。
- main surface を native `TextEditor` に保ったまま `vscode.diff` に近づけるのか、panel をより強い primary surface に育てるのかを、次の設計判断として閉じる必要がある。
