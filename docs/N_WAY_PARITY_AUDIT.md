# N-Way Parity Audit

Updated: 2026-03-20

This is the living audit document for tracking whether Fukusa's N-way compare extends the UX of native 2-way diff without approximation. The current revision is an initial audit backed by code inspection, existing documentation, and automated test evidence. Direct desktop visual evidence has not yet been captured in this document, so the end-to-end rows remain `unknown`.

## 監査方針

- Baseline: the acceptance baseline is VS Code native 2-way diff UX, not the repository's current `best-effort` wording.
- Primary evaluation surface: `native`.
- Secondary evaluation surface: `panel`, used as a shared-model consistency check and as the single-scroll escape hatch.
- Evidence priority per row: implementation code, surfaced command/config contracts, automated tests, then desktop visual evidence.
- A row is only valid if the reproduction or proof can be stated in one line.
- Visual mismatches should eventually attach screenshots under `docs/audit-evidence/YYYY-MM-DD/`.
- `platform-limit` is reserved for cases where the current public VS Code API blocks parity on the current architecture. It is not a synonym for "hard" or "not yet done."

### 状態定義

| 状態 | 意味 | スコア係数 |
| --- | --- | --- |
| `match` | 現在の証拠で基準挙動に達している | `1.0` |
| `partial` | 一部成立しているが、意味論・体験・証拠のどれかが不足 | `0.5` |
| `mismatch` | 現在の挙動が基準と明確にずれている | `0.0` |
| `missing` | 挙動自体が存在しない | `0.0` |
| `platform-limit` | 現在の public API と現行アーキテクチャの組み合わせでは達成不能 | `0.0` |
| `unknown` | 実機証拠が足りず判定不能 | `0.0` |

### 重要度定義

| 重要度 | 重み |
| --- | --- |
| `critical` | `5` |
| `major` | `3` |
| `minor` | `1` |

## 真実源の優先順位

| Tier | ソース | 分類 | この監査での使い方 | 主な衝突点 |
| --- | --- | --- | --- | --- |
| 1 | [implementation](../src), [package.json](../package.json), 2026-03-20 の `npm run compile` / `npm run test:*` 実行結果 | `current fact` | 最優先の事実源 | docs の表現より優先 |
| 2 | [SPEC.md](./SPEC.md), [USER_GUIDE.md](./USER_GUIDE.md) | `current claim` | 現行仕様として主張している内容の検証対象 | native scroll を `best-effort` と認めており、本監査の基準と衝突 |
| 3 | [README.md](../README.md), [CLAUDE.md](../CLAUDE.md) | `helper` | 表面機能、構成、主要ファイルの索引 | 実装の完全な契約ではない |
| 4 | [adr_006_single_tab_panel_surface.md](./adr_006_single_tab_panel_surface.md), [adr_007_pair_projection_model.md](./adr_007_pair_projection_model.md), [adr_008_row_projection_layer.md](./adr_008_row_projection_layer.md), [adr_009_session_viewport_model.md](./adr_009_session_viewport_model.md) | `current design intent` | いまの設計意図と制約整理 | 実装済み保証には使わない |
| 5 | [adr_003_single_tab_compare_surface.md](./adr_003_single_tab_compare_surface.md) | `obsolete / superseded` | historical constraint note only | [adr_006_single_tab_panel_surface.md](./adr_006_single_tab_panel_surface.md) に supersede 済み |
| 6 | [Fukusa_nway_redesign_plan_2026-03-15.md](./Fukusa_nway_redesign_plan_2026-03-15.md), [archive/Fukusa_design_v0.2.md](./archive/Fukusa_design_v0.2.md) | `future intent / obsolete` | 将来構想または過去設計の参照のみ | 現行コードと一致しない箇所が多い |

### 監査上の重要な衝突

- [USER_GUIDE.md](./USER_GUIDE.md) と [SPEC.md](./SPEC.md) は native scroll sync を `best-effort` と認めているが、この監査では受け入れ条件として扱わない。
- [Fukusa_nway_redesign_plan_2026-03-15.md](./Fukusa_nway_redesign_plan_2026-03-15.md) は pair-first / native diff 前提の古い問題設定を含むため、現行完成度の根拠には使えない。
- [adr_003_single_tab_compare_surface.md](./adr_003_single_tab_compare_surface.md) は historical note としては有用だが、現行 surface contract は [adr_006_single_tab_panel_surface.md](./adr_006_single_tab_panel_surface.md) を優先する。

## 完成度スコア

### 集計ルール

- `weighted score = sum(weight * statusFactor) / sum(weight)`
- `statusFactor`: `match=1.0`, `partial=0.5`, others `0.0`
- The score measures parity confidence, not code volume or test count.

### 初期スコア

| 観点 | 獲得点 / 満点 | 進捗率 | コメント |
| --- | --- | --- | --- |
| Foundational model and command surface | `13.0 / 19` | `68.4%` | モデル・コマンド・VCS 基盤は成立しているが、UI parity 証拠は不足 |
| Native parity surface | `15.5 / 52` | `29.8%` | 厳密一致に必要な UX が最も不足 |
| Panel alternative surface | `1.5 / 6` | `25.0%` | single-scroll の土台はあるが、line number semantics がまだ遠い |
| End-to-end visual proof | `0.0 / 10` | `0.0%` | 実機スクリーンショット証拠が未収集 |
| **Overall** | **`29.5 / 84`** | **`35.1%`** | ユーザー所感の「3割程度」と整合的な初期値 |

### スコア解釈

- The repository is no longer at prototype-zero. The compare model, pair projection, projection state, and panel/native switching all exist and are covered by tests.
- The parity bottleneck is concentrated in native UX: empty-side semantics, exact scroll behavior, and the gap between `TextEditor + decorations` and true native diff affordances.
- The current automated suite validates controller intent, not visual equivalence.

## 監査マトリクス

| ID | 監査項目 | 2-way 基準挙動 | 現状 N-way 挙動 | 証拠 | 状態 | 重要度 | 所有レイヤ | 次アクション | 再確認条件 | 最終確認日 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `F01` | セッション生成と revision 順序 | 選択順と対象ファイルが安定して compare session に入る | セッション生成、revision 順序、pair projection 初期化は成立している | [sessionBuilderService.ts](../src/application/sessionBuilderService.ts), [browseRevisions.ts](../src/commands/browseRevisions.ts), [openDiffSelection.test.ts](../src/test/unit/openDiffSelection.test.ts), [sessionBuilderService.test.ts](../src/test/unit/sessionBuilderService.test.ts) | `match` | `major` | `application` | 実機で Git/SVN の revision picker 選択順を確認 | 3 rev / 4 rev / custom pair 選択の UI 収録 | 2026-03-20 |
| `F02` | Pair projection presets と command surface | `adjacent / base / all / custom` が選択でき、visible pairs が安定する | モデル、正規化、コマンド表出は成立している | [comparePairing.ts](../src/application/comparePairing.ts), [changePairProjection.ts](../src/commands/changePairProjection.ts), [comparePairing.test.ts](../src/test/unit/comparePairing.test.ts), [changePairProjection.test.ts](../src/test/unit/changePairProjection.test.ts) | `match` | `major` | `application`, `commands` | 実機で custom pair の再選択 UX を観察 | 3+ rev で projection 切替スクリーンショット取得 | 2026-03-20 |
| `F03` | Active pair / visible window semantics | 表示中の比較意味が安定し、フォーカス変化で説明可能に変わる | active pair は focus と visible window から導出されるため、色の意味が列フォーカスに依存して変わる | [sessionViewport.ts](../src/application/sessionViewport.ts), [sessionCapabilities.ts](../src/application/sessionCapabilities.ts), [sessionViewport.test.ts](../src/test/unit/sessionViewport.test.ts), [sessionService.test.ts](../src/test/unit/sessionService.test.ts) | `partial` | `major` | `application` | active pair の表示規約を UI 文言まで含めて固定する | focus 移動だけで色の意味が変わるケースを収録 | 2026-03-20 |
| `N01` | Adjacent-chain global alignment | 2-way diff の差分認識を壊さず 3+ rev に拡張される | alignment core は成立しているが、progressive left-to-right merge で曖昧ケースの安定性はまだ限定証拠 | [nWayAlignmentEngine.ts](../src/application/nWayAlignmentEngine.ts), [sessionAlignmentService.ts](../src/application/sessionAlignmentService.ts), [sessionAlignmentService.test.ts](../src/test/unit/sessionAlignmentService.test.ts), [nWayAlignmentEngine.core.test.ts](../src/test/unit/nWayAlignmentEngine.core.test.ts) | `partial` | `critical` | `application` | repeated lines と reorder を含む実 repo ケースで監査を追加 | ambiguous hunk の screenshot と pair diff 比較が揃うこと | 2026-03-20 |
| `N02` | Non-adjacent pair overlay parity | `A-C` を見たときも native pair diff と意味が揃う | non-adjacent overlay は direct pair diff ではなく shared `globalRows` 比較で生成されるため、完全一致保証がない | [comparePairing.ts](../src/application/comparePairing.ts), [compareRowDisplayState.ts](../src/application/compareRowDisplayState.ts), [comparePairing.test.ts](../src/test/unit/comparePairing.test.ts), [compareRowDisplayState.test.ts](../src/test/unit/compareRowDisplayState.test.ts) | `partial` | `critical` | `application` | direct pair diff との差分監査を追加し、意味論を明文化する | `base / all / custom` で `vscode.diff` と比較した証拠が揃うこと | 2026-03-20 |
| `N03` | Native の空側網掛け | 追加行では存在しない側が diff 空側として背景表示される | absent cell は空文字行として描画され、装飾は present side にしか付かない | [alignedSessionDocumentProvider.ts](../src/infrastructure/fs/alignedSessionDocumentProvider.ts), [compareRowDisplayState.ts](../src/application/compareRowDisplayState.ts), [diffDecorationController.ts](../src/presentation/native/diffDecorationController.ts), [alignedSessionDocumentProvider.test.ts](../src/test/unit/alignedSessionDocumentProvider.test.ts) | `mismatch` | `critical` | `presentation/native`, `infrastructure/fs` | empty-side 専用 decoration か surface redesign を設計する | 追加のみケースで空側背景が native diff と一致すること | 2026-03-20 |
| `N04` | Native の空側行番号非表示 | 追加行では存在しない側に行番号が出ない | native compare binding は `lineNumberSpace: 'globalRow'` 固定で、空行にも通常の editor line number が出る | [nativeCompareSessionController.ts](../src/presentation/native/nativeCompareSessionController.ts), [types.ts](../src/adapters/common/types.ts), [alignedSessionDocumentProvider.ts](../src/infrastructure/fs/alignedSessionDocumentProvider.ts), [VS Code API: TextEditorOptions](https://code.visualstudio.com/api/references/vscode-api#TextEditorOptions) | `platform-limit` | `critical` | `presentation/native`, `infrastructure/fs` | 現行 TextEditor gutter を捨てるか、別 surface に寄せる設計判断が必要 | per-line line number suppression の代替戦略が決まること | 2026-03-20 |
| `N05` | Native の行背景と行内差分 | active pair 上では line background と intraline が diff として読める | active pair に対して added/removed/modified は付くが、詳細強調は active pair のみで、全 visible pair には広がらない | [compareRowDisplayState.ts](../src/application/compareRowDisplayState.ts), [diffDecorationController.ts](../src/presentation/native/diffDecorationController.ts), [diffDecorationController.test.ts](../src/test/unit/diffDecorationController.test.ts) | `partial` | `major` | `presentation/native`, `application` | active pair 以外の見え方を仕様化し、native diff parity と比較する | 置換・追加・削除の実機スクリーンショットが揃うこと | 2026-03-20 |
| `N06` | Native diff 固有 affordance parity | connectors、overview、change navigation など diff editor 固有の認知支援がある | main native surface は `showTextDocument` + decorations であり、`vscode.diff` 固有 affordance は escape hatch に退避している | [nativeCompareSessionController.ts](../src/presentation/native/nativeCompareSessionController.ts), [openActiveSessionPairDiff.ts](../src/commands/openActiveSessionPairDiff.ts), [diffDecorationController.ts](../src/presentation/native/diffDecorationController.ts) | `mismatch` | `critical` | `presentation/native`, `commands` | parity 対象を再定義するか、surface を再設計する | native surface の affordance target を決め直すこと | 2026-03-20 |
| `N07` | `Ctrl+Up/Down` の aligned scroll | keyboard scroll で visible peers が即時に揃う | 内部 command 経由の aligned scroll はよくテストされている | [scrollAligned.ts](../src/commands/scrollAligned.ts), [editorSyncController.ts](../src/presentation/native/editorSyncController.ts), [editorSyncController.test.ts](../src/test/unit/editorSyncController.test.ts), [scrollAlignedCommands.test.ts](../src/test/unit/scrollAlignedCommands.test.ts) | `match` | `major` | `presentation/native`, `commands` | 実機で sticky scroll on/off を撮る | keyboard scroll の動画または screenshot 証拠 | 2026-03-20 |
| `N08` | wheel / trackpad / scrollbar の zero-lag vertical sync | pointer-driven scroll でも時差ゼロ・ズレゼロで揃う | 現実装は `visibleRanges`、32ms debounce、80ms verify、150ms suppression に依存し、docs も slight drift を認めている | [editorSyncController.ts](../src/presentation/native/editorSyncController.ts), [SPEC.md](./SPEC.md), [USER_GUIDE.md](./USER_GUIDE.md), [VS Code API: TextEditor](https://code.visualstudio.com/api/references/vscode-api#TextEditor) | `platform-limit` | `critical` | `presentation/native` | strict parity を native で追うのか panel を主面に寄せるのか判断する | public API で pixel-precise sync を実証するか、別 surface 方針を採ること | 2026-03-20 |
| `N09` | Native horizontal scroll parity | 横スクロールも列間で破綻しない | public `TextEditor` API から horizontal scroll state を扱えず、repo docs も panel を single-scroll escape hatch にしている | [adr_003_single_tab_compare_surface.md](./adr_003_single_tab_compare_surface.md), [adr_006_single_tab_panel_surface.md](./adr_006_single_tab_panel_surface.md), [VS Code API: TextEditor](https://code.visualstudio.com/api/references/vscode-api#TextEditor) | `platform-limit` | `critical` | `presentation/native` | native 厳密一致のスコープを見直す | horizontal parity の方針決定 | 2026-03-20 |
| `N10` | Collapse unchanged / gap expansion | unchanged folding が差分理解を壊さず、展開/リセットが安定する | shared row projection はあるが、all-gap case では native compare document が空になり、文脈再現は弱い | [compareRowProjection.ts](../src/application/compareRowProjection.ts), [sessionRowProjection.ts](../src/application/sessionRowProjection.ts), [alignedSessionDocumentProvider.test.ts](../src/test/unit/alignedSessionDocumentProvider.test.ts), [sessionViewport.test.ts](../src/test/unit/sessionViewport.test.ts), [toggleCollapseUnchanged.test.ts](../src/test/unit/toggleCollapseUnchanged.test.ts) | `partial` | `major` | `application`, `presentation/native`, `presentation/compare` | all-gap case と diff context の扱いを仕様化する | collapse / expand / reset の実機証拠が揃うこと | 2026-03-20 |
| `N11` | Window shift / focus / top-row continuity | 9+ rev でも shift 後の focus とスクロール continuity が壊れない | コントローラは top global row 復元と再描画を持つが、tab close/open を伴うため視覚 continuity は未証明 | [nativeCompareSessionController.ts](../src/presentation/native/nativeCompareSessionController.ts), [sessionViewport.ts](../src/application/sessionViewport.ts), [nativeCompareSessionController.test.ts](../src/test/unit/nativeCompareSessionController.test.ts), [sessionService.test.ts](../src/test/unit/sessionService.test.ts) | `partial` | `critical` | `presentation/native`, `application` | 10+ rev 実機ケースを最優先で撮る | 9+ rev / 10+ rev の scroll continuity 証拠が揃うこと | 2026-03-20 |
| `N12` | Surface switch 後の shared session drift | native/panel 切替で active revision, active pair, collapse state がずれない | service と coordinator のロジックは成立しているが、UI visual drift は未監査 | [compareSurfaceCoordinator.ts](../src/presentation/compare/compareSurfaceCoordinator.ts), [panelCompareSessionController.ts](../src/presentation/compare/panelCompareSessionController.ts), [compareSurfaceCoordinator.test.ts](../src/test/unit/compareSurfaceCoordinator.test.ts), [panelCompareSessionController.test.ts](../src/test/unit/panelCompareSessionController.test.ts) | `partial` | `major` | `presentation/compare`, `presentation/native`, `application` | 切替前後の same-session screenshot を残す | active pair / collapse / page state 維持の実機証拠 | 2026-03-20 |
| `P01` | Panel の single-scroll model | 1 scroll container 上で全列が完全同期する | 設計とテスト上は 1 scroll container だが、実機視覚証拠は未添付 | [panelCompareSessionController.ts](../src/presentation/compare/panelCompareSessionController.ts), [comparePanelDocument.ts](../src/presentation/compare/comparePanelDocument.ts), [panelCompareSessionController.test.ts](../src/test/unit/panelCompareSessionController.test.ts) | `partial` | `major` | `presentation/compare` | 実機スクリーンショットと動画を取得 | panel 実機証拠が添付されること | 2026-03-20 |
| `P02` | Panel の line number semantics | line number の意味が diff 画面として誤解なく読める | panel は shared global row number を 1 本の gutter に出し、per-column original line number を出していない | [comparePanelDocument.ts](../src/presentation/compare/comparePanelDocument.ts), [panelCompareSessionController.ts](../src/presentation/compare/panelCompareSessionController.ts) | `mismatch` | `major` | `presentation/compare` | panel 用 line number policy を定義し直す | original/global をどう見せるか決定すること | 2026-03-20 |
| `F04` | Snapshot open / pair diff escape hatch | focused revision / pair を詳細確認へ逃がせる | command は成立しているが、実機で session context を壊さないか未確認 | [openActiveSessionSnapshot.ts](../src/commands/openActiveSessionSnapshot.ts), [openActiveSessionPairDiff.ts](../src/commands/openActiveSessionPairDiff.ts), [openActiveSessionSnapshot.test.ts](../src/test/unit/openActiveSessionSnapshot.test.ts), [openActiveSessionPairDiff.test.ts](../src/test/unit/openActiveSessionPairDiff.test.ts) | `partial` | `major` | `commands`, `presentation` | 実機で focus return と tab behavior を確認 | pair diff / snapshot open の往復証拠が揃うこと | 2026-03-20 |
| `F05` | Command context と Sessions tree | 利用可能アクションが session 状態と一貫する | context keys と tree item tokens はよくカバーされている | [sessionCommandContextController.ts](../src/commands/sessionCommandContextController.ts), [sessionsTreeProvider.ts](../src/presentation/views/sessionsTreeProvider.ts), [sessionCommandContextController.test.ts](../src/test/unit/sessionCommandContextController.test.ts), [sessionsTreeProvider.test.ts](../src/test/unit/sessionsTreeProvider.test.ts) | `match` | `minor` | `commands`, `presentation/views` | 実機で menu surfacing を一度撮る | Sessions tree の menu screenshot | 2026-03-20 |
| `F06` | Git adapter 基盤 | history / snapshot / blame を実 repo から取得できる | Git 基盤は実 repo integration で成立しているが、viewer parity そのものは未証明 | [gitAdapter.ts](../src/adapters/git/gitAdapter.ts), [gitCli.ts](../src/adapters/git/gitCli.ts), [gitAdapter.test.ts](../src/test/integration/gitAdapter.test.ts) | `partial` | `major` | `adapters/git` | Git 実機 parity scenarios に接続する | Git の visual parity 証拠が揃うこと | 2026-03-20 |
| `F07` | SVN adapter 基盤 | history / snapshot / blame を実 working copy から取得できる | SVN 基盤は実 working copy integration で成立しているが、viewer parity そのものは未証明 | [svnAdapter.ts](../src/adapters/svn/svnAdapter.ts), [svnCli.ts](../src/adapters/svn/svnCli.ts), [svnAdapter.test.ts](../src/test/integration/svnAdapter.test.ts) | `partial` | `major` | `adapters/svn` | SVN parity scenarios を Git と同じ観点で撮る | SVN の visual parity 証拠が揃うこと | 2026-03-20 |
| `R01` | End-to-end Git visual parity | Git の追加/削除/置換/whitespace/3+/9+ rev が screenshot 付きで監査済み | 2026-03-20 時点で automated evidence のみ。desktop visual proof は未添付 | [gitAdapter.test.ts](../src/test/integration/gitAdapter.test.ts), [USER_GUIDE.md](./USER_GUIDE.md), [SPEC.md](./SPEC.md) | `unknown` | `critical` | `qa` | 実機シナリオを実行し、A 系/N 系の証拠を回収する | Git scenario set の screenshot と観察メモが揃うこと | 2026-03-20 |
| `R02` | End-to-end SVN visual parity | SVN の追加/削除/置換/3+ rev が screenshot 付きで監査済み | 2026-03-20 時点で automated evidence のみ。desktop visual proof は未添付 | [svnAdapter.test.ts](../src/test/integration/svnAdapter.test.ts), [USER_GUIDE.md](./USER_GUIDE.md), [SPEC.md](./SPEC.md) | `unknown` | `critical` | `qa` | SVN 実機シナリオを Git と同じ観点で実行する | SVN scenario set の screenshot と観察メモが揃うこと | 2026-03-20 |

## テスト監査

### 2026-03-20 に実行したコマンド

- `npm run compile`
- `npm run test:unit -- --grep "Unit: (EditorSyncController|DiffDecorationController|AlignedSessionDocumentProvider|compareRowDisplayState|ComparePanelDocument|PanelCompareSessionController|NativeCompareSessionController)"`
- `npm run test:integration`

### 実行結果サマリ

- Compile: pass
- Unit suite: `172 passing`
- Integration suite: `3 passing`

### 既存テストで証明できること

- Pair projection 正規化、visible pair 導出、custom pair 選択のロジック
- Session build、selection state、visible window paging、window shift の純粋ロジック
- Shared row projection と gap expand/reset
- `globalRows`、`lineMap`、intraline diff の代表ケース
- Native diff decoration model と projected line map 変換
- Native keyboard aligned scroll の controller logic
- Panel/native の shared session refresh と surface switch rollback
- Git/SVN adapter の history/snapshot/blame 基盤

### 既存テストで証明できないこと

- native editor 実描画が `vscode.diff` と視覚的に一致すること
- 空側網掛け、空側行番号非表示、connector 表現、change navigation の実 UI
- wheel / trackpad / scrollbar drag の zero-lag scroll sync
- 9+ revision window shift 時の実 editor-group continuity
- panel の global row gutter がユーザーに誤解なく読めること
- Git/SVN の実機 parity screenshot

### テスト監査の結論

- The automated suite is strong for pure logic and controller intent.
- The automated suite is weak for native diff parity, because almost all parity-critical gaps live in VS Code rendering behavior rather than in pure TypeScript branches.
- `green tests != parity achieved` is a current repository fact, not a hypothetical risk.

## 実機監査

Current status: desktop visual evidence is not yet attached in this initial revision. The scenarios below are locked and should be executed exactly as written in the next audit pass.

| Scenario ID | 再現手順 1 行 | 主要対象行 | 期待する証拠 | 現在の状態 |
| --- | --- | --- | --- | --- |
| `M01` | Git で `A: no line -> B: added line -> C: same added line` の 3 rev compare を開く | `N03`, `N04`, `N05`, `R01` | 空側背景、空側行番号、active pair 強調の screenshot | `pending` |
| `M02` | Git で `A: line exists -> B: deleted -> C: deleted` の 3 rev compare を開く | `N03`, `N04`, `N05`, `R01` | 削除の逆パターン screenshot | `pending` |
| `M03` | Git で whitespace-only change を含む 3 rev compare を開く | `N01`, `N05`, `R01` | intraline と modified semantics の screenshot | `pending` |
| `M04` | Git で 4 rev compare を `adjacent / base / all / custom` に切り替える | `F02`, `F03`, `N02`, `R01` | same row の意味変化を比較した screenshot | `pending` |
| `M05` | Git で 10+ rev compare を開き、右 shift 後に scroll と focus を維持する | `N11`, `R01` | shift 前後の top-row continuity 証拠 | `pending` |
| `M06` | native で keyboard, wheel, trackpad, scrollbar drag をそれぞれ試す | `N07`, `N08`, `N09`, `R01` | drift の有無を示す動画または連続 screenshot | `pending` |
| `M07` | sticky scroll を on/off して native scroll sync を比較する | `N07`, `N08`, `R01` | sticky on/off の差分証拠 | `pending` |
| `M08` | collapse unchanged, expand gap, reset gap を native と panel で往復する | `N10`, `N12`, `P01`, `R01` | same session state の維持 screenshot | `pending` |
| `M09` | panel で same scenario を開き、row number と empty cell semantics を確認する | `P01`, `P02`, `R01` | global row gutter の読みにくさを示す screenshot | `pending` |
| `M10` | SVN で `M01` から `M04` までを同観点で実施する | `F07`, `R02` | Git との差異を並べた screenshot | `pending` |

## 未完了項目バックログ

| Priority | Item | Related Audit IDs | Why it blocks parity |
| --- | --- | --- | --- |
| `P0` | Native empty-side semantics を設計し直す | `N03`, `N04` | 追加/削除の最も基本的な diff 認知が現状のままでは成立しない |
| `P0` | strict scroll parity の surface 方針を決める | `N08`, `N09` | native `TextEditor` 維持か panel 主面化かで設計が根本的に変わる |
| `P0` | Non-adjacent pair overlay の direct-diff parity 方針を決める | `N02`, `F03` | `base / all / custom` の意味が曖昧だと N-way compare の主価値が崩れる |
| `P1` | Native affordance gap の扱いを定義する | `N06` | connector / overview / navigation を parity 対象に残すかどうか未固定 |
| `P1` | Window shift continuity を実機で潰す | `N11` | 10+ revision 運用の usability に直結する |
| `P1` | Panel line number policy を決める | `P02` | panel を strict surface に寄せるなら row numbering の意味論が必要 |
| `P1` | Git/SVN visual parity evidence pipeline を作る | `R01`, `R02` | 今後の進捗管理が主観に戻るのを防ぐ |
| `P2` | Collapse unchanged の all-gap / context semantics を詰める | `N10` | 長文書での usability を左右するが、P0 項目よりは後ろ |

## API/プラットフォーム制約

| ID | 制約 | 根拠 | 現在の影響 | 現在のスタンス |
| --- | --- | --- | --- | --- |
| `APC01` | `TextEditor.visibleRanges` は vertical range のみを表し、horizontal scroll state を提供しない | [VS Code API: TextEditor](https://code.visualstudio.com/api/references/vscode-api#TextEditor) | native columns の horizontal parity は panel に逃がされている | `N09` を `platform-limit` として扱う |
| `APC02` | `TextEditor.revealRange()` は reveal strategy API であり、pixel-precise multi-editor sync API ではない | [VS Code API: TextEditor](https://code.visualstudio.com/api/references/vscode-api#TextEditor), [SPEC.md](./SPEC.md), [USER_GUIDE.md](./USER_GUIDE.md) | native wheel/trackpad/scrollbar sync は `best-effort` 実装に留まる | `N08` を `platform-limit` として扱う |
| `APC03` | `TextEditorOptions.lineNumbers` は editor-wide option であり、absent row だけ line number を消す public API がない | [VS Code API: TextEditorOptions](https://code.visualstudio.com/api/references/vscode-api#TextEditorOptions) | native empty-side line number suppression は現アーキテクチャで詰まる | `N04` は architecture-level redesign 候補 |
| `APC04` | Main native surface は `vscode.diff` ではなく `showTextDocument` + decorations を使っている | [nativeCompareSessionController.ts](../src/presentation/native/nativeCompareSessionController.ts), [openActiveSessionPairDiff.ts](../src/commands/openActiveSessionPairDiff.ts) | built-in diff affordances は main surface に自動では乗らない | `N06` は単純な微修正では埋まらない |

### 現時点の監査結論

- The codebase has crossed the "basic feature exists" threshold.
- It has not crossed the "strictly extends 2-way diff UX" threshold.
- The largest parity gap is not repository access or model construction. It is the rendering contract of the native surface.
