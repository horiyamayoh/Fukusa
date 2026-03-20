# Fukusa 抜本再設計プラン（N-way Compare 再定義 / v0.1）

作成日: 2026-03-15  
対象: `horiyamayoh/Fukusa`  
目的: 現行の「pair diff を複数並べる」前提を捨て、**1 revision = 1列**で表示する本物の N-way compare へ設計を切り替えるための全体方針と、設計書を作成するための計画を定義する。

---

## 1. 先に結論

今回の要件に対しては、**現行実装の延長線上での修正ではなく、比較表示レイヤを中心にゼロベースで再設計する**のが正解です。

理由は単純で、現行 Fukusa の中心モデルがすでに

- `A-B`, `B-C`, `C-D` のような **pair の列**
- `visiblePairCount` と `shift window` による **pair windowing**
- `vscode.diff` を並べることで成立する **native diff editor 前提**

で組まれているためです。ここに対して「A / B / C を各1回だけ並べる」「B を重複させない」「A-B / B-C / A-C を表示切替する」「行内差分を重ねる」「スクロールを完全同期する」を後付けすると、**ペア中心モデルそのものが足かせ**になります。

したがって、今回の再設計では次を基本方針にします。

1. **compare surface の主役を native diff editor から外す**  
2. **snapshot を真実源として、独自の N-way alignment / overlay engine を作る**  
3. **表示は 1 本のスクロール面を持つ custom viewer に寄せる**  
4. **native editor / native diff は補助導線として残す**

要するに、**「Native Editor First」は捨てるが、「Native Editor を捨てる」のではない**、という方針です。  
N-way compare 自体は自前 viewer、個別の revision 調査や pair 確認は native editor へ逃がします。

---

## 2. 今回固定したいゴール

今回の再設計でまず固定すべき UX ゴールは以下です。

### 2.1 必須ゴール

- 1 つのファイルに対し、`A, B, C, ...` の **各 revision を 1 回ずつだけ**表示する
- 表示は **A | B | C | ...** の列構成にする
- スクロールは **1 本のスクロールモデル**で管理し、完全同期させる
- `A-B`, `B-C`, `A-C` などの **pair overlay** を設定で切り替えられる
- pair overlay を切り替えても **列の並びやレイアウトは変わらない**
- 行単位差分だけでなく **行内差分**も表示する

### 2.2 暗黙に重要なゴール

- `A-B`, `B-C` を別々の native diff editor として並べない
- 中間 revision（例: `B`）を重複表示しない
- 「どの pair を強調するか」と「どの revision を並べるか」を分離する
- 非 adjacent pair（例: `A-C`）を選んでも、表示の土台は崩さない

### 2.3 非ゴール（初期段階で追わない）

- N-way compare 面で native editor と完全同等の言語機能を再現すること
- N 個の Monaco / native editor を横に置いて擬似的に同期すること
- blame overlay を compare viewer に最初から統合すること
- move detection まで含めた高度な構文差分を初版から完成させること

---

## 3. 現行実装の何が根本的に合っていないか

### 3.1 現行の中心モデルは「N-way」ではなく「複数 pair」

現行 `SessionService` は session を `DiffPair[]` として構築します。  
つまり内部モデルは最初から

- `adjacent`: `A-B`, `B-C`, `C-D`
- `base`: `A-B`, `A-C`, `A-D`

という **pair の集合**です。

この時点で、ユーザーが欲しい「A / B / C を各1回だけ表示する compare 面」とはモデルが一致していません。

### 3.2 表示も pair ごとに `vscode.diff` を開く設計になっている

現行 `NativeDiffSessionController` は visible pair を切り出し、`EditorLayoutController` で列を作ったうえで `vscode.diff(left, right, ...)` を順に開いています。  
つまり UI も完全に **pair diff の並列表示**です。

この設計では、B を 1 回しか出さない compare surface は作れません。  
それは実装不足ではなく、**設計が pair-first だから**です。

### 3.3 `shift window` は現行設計の副作用であって、本来欲しい UX ではない

`visiblePairCount` と `shiftWindowLeft/Right` は、native diff editor を横に並べる制約を回避するための仕組みです。  
しかし、今回欲しいのは「pair の可視 window をずらす」ことではなく、**1 本の compare surface 上で N revision をそのまま辿れること**です。

したがって `shift window` という概念自体が、目標 UX から見ると不要になる可能性が高いです。

### 3.4 既存の `getDiff()` も主役にはできない

Git / SVN adapter は `getDiff(left, right)` を持っていますが、返しているのは CLI の unified diff 文字列です。  
これは pair の差分を取るには使えますが、

- N-way alignment の土台
- layout を固定したまま複数 pair overlay を切り替えること
- 行内差分を pair ごとに遅延計算すること

の中心モデルには向きません。  
**compare の真実源は unified diff text ではなく snapshot 群**に寄せるべきです。

---

## 4. 採るべき大方針

### 4.1 compare surface を自前 viewer に切り替える

今回の本丸はここです。

### 推奨方針

- **N-way compare の主表示面は custom viewer（Webview ベース）にする**
- extension host 側で snapshot / diff / alignment を計算する
- viewer 側は 1 本のスクロール面で rows × columns を描画する

### なぜこれが必要か

native diff editor は 2 リソース比較のための完成度は高いですが、今回欲しいのは

- 1 file / N revisions
- 1 revision = 1 column
- single scroll model
- pair overlay toggle
- inline diff per pair

という、**native diff editor そのものではない UI**です。

つまり今回必要なのは「VS Code の diff editor を増やすこと」ではなく、**Fukusa 専用の compare 面を持つこと**です。

### 4.2 Native Editor First を「補助導線 First」に読み替える

今後の役割分担は次のように変えます。

### compare viewer が担うもの

- N-way column layout
- global row alignment
- pair overlay の切り替え
- row / hunk の視覚化
- inline diff の表示
- single scroll

### native editor / diff が担うもの

- 任意 revision を通常 editor として精読する
- 任意 pair を native diff editor で詳しく確認する
- 言語機能や定義ジャンプが必要になった時の escape hatch

この分離にすると、「N-way compare を成立させるために native editor へ無理をさせる」必要がなくなります。

### 4.3 レイアウトと強調対象を分離する

これも非常に重要です。

現行の `Adjacent` / `Base` は「どの pair を物理的に開くか」を意味しています。  
新設計ではこれをやめて、

- **レイアウト:** `A | B | C | D | ...`
- **overlay preset:** `adjacent`, `base`, `custom`, `all`

に分けます。

つまり

- 列配置はいつも `A | B | C | D`
- `Adjacent` は `A-B`, `B-C`, `C-D` を強調する preset
- `Base` は `A-B`, `A-C`, `A-D` を強調する preset

という意味に再定義します。

この設計にすると、`A-C` を表示しても B を重複させる必要がなく、**レイアウトが安定したまま比較対象だけ切り替えられます。**

---

## 5. 推奨アーキテクチャ

```text
+-------------------------------------------------------------+
| VS Code Commands / QuickPick / Session Entry                |
| - Open Multi-Revision Compare                               |
| - Open Revision Snapshot                                    |
| - Open Pair in Native Diff                                  |
+-------------------------------+-----------------------------+
                                |
                                v
+-------------------------------------------------------------+
| Application Layer                                             |
| - CompareSessionService                                       |
| - SnapshotLoader                                              |
| - NWayAlignmentEngine                                         |
| - PairOverlayProjector                                        |
| - InlineDiffEngine                                            |
| - ViewModelAssembler                                          |
+-------------------------------+-----------------------------+
                                |
                 +--------------+--------------+
                 |                             |
                 v                             v
+----------------------------------+   +-----------------------+
| Infrastructure / Data Sources    |   | Viewer Host           |
| - GitAdapter / SvnAdapter        |   | - WebviewPanel        |
| - RevisionPickerService          |   | - Message Bridge      |
| - CacheService                   |   | - Theme Sync          |
| - SnapshotFsProvider (auxiliary) |   | - Native Open Actions |
+----------------------------------+   +-----------------------+
                                              |
                                              v
                                     +-------------------------+
                                     | Custom Compare Viewer   |
                                     | - single scroll surface |
                                     | - virtualized row grid  |
                                     | - pair overlay legend   |
                                     | - inline diff painter   |
                                     +-------------------------+
```

---

## 6. 中核となる設計原則

### 原則 1: One Revision, One Column

どの revision も compare 面では **一度しか表示しない**。  
pair ごとの複製は禁止する。

### 原則 2: Layout Is Stable, Overlay Is Variable

列の並びと row alignment は固定し、pair highlight はその上に投影する。  
overlay を切り替えても layout を組み直さない。

### 原則 3: Snapshot Is Source of Truth

VCS が返す raw diff text は補助情報。  
compare の真実源は **各 revision の snapshot** とする。

### 原則 4: Core Engine Must Not Depend on VS Code UI

alignment / overlay / inline diff のロジックは pure TypeScript に寄せる。  
VS Code 依存コードは host / adapter 層に閉じ込める。

### 原則 5: Native Interop Is an Escape Hatch

native editor は compare 面の代替ではなく、深掘り時の補助導線として使う。

### 原則 6: First Build Correctness, Then Polish UX

最初にやるべきは CSS でも Webview でもなく、**A/B/C fixture に対する row alignment の正しさ**を保証すること。

---

## 7. 比較エンジンの推奨設計

### 7.1 なぜ pair diff の寄せ集めではダメか

`A-B`, `B-C` を別々に描くと、B が重複します。  
これはユーザー要件に反します。

必要なのは pair diff の表示ではなく、**N 個の snapshot を 1 つの row grid に揃えること**です。

### 7.2 推奨する計算パイプライン

### Step 1: Snapshot を正規化する

各 revision について以下を作る。

- raw text
- lines
- line hash
- line index / offset
- optional normalized line（ignore whitespace 用）

### Step 2: 隣接 pair の line alignment を作る

revision order を `R0, R1, R2, ...` としたとき、まずは

- `R0-R1`
- `R1-R2`
- `R2-R3`

の **adjacent pair alignment** を作る。

アルゴリズムは以下を推奨。

1. **Patience diff 的な anchor 検出**で安定点を先に取る
2. anchor 間の領域は **Myers 系 line diff**で埋める
3. replace hunk 内は **line similarity による 1:1 寄せ**を追加して、delete/insert だけでなく modified row を作る

ポイントは、**「行が変わった」ケースでも可能なら横に並べる**ことです。  
これがないと、変更行が全部 delete / insert の縦積みになって見づらくなります。

### Step 3: line graph を作る

各 line occurrence を node とし、adjacent pair alignment で対応がついた line 同士を edge で結ぶ。

- `equal` は強い対応
- `modified` は弱い対応だが row continuity のために結んでよい
- `insert/delete` は孤立 node のまま

### Step 4: global row order を作る

各 revision の行順を制約として component DAG を作り、topological sort で **global row sequence** を得る。

この結果、各 row は

- A には line がある
- B には空セル
- C には line がある

のような **N 列 row**になります。

### Step 5: pair overlay を投影する

global row は固定し、そこに対して

- adjacent pairs (`A-B`, `B-C`)
- base pairs (`A-B`, `A-C`)
- custom pair (`A-C` だけ)

を overlay として重ねます。

### Step 6: inline diff は遅延計算する

row と pair が確定してから、その row のその pair だけ行内差分を計算します。  
これにより、全 pair × 全 row の行内差分を最初から計算せずに済みます。

### 7.3 重要な設計判断

### 判断 A: row grid は pair overlay と独立させる

これを守ると、`A-B` から `A-C` に切り替えても、画面の行が飛ばず、ユーザーの視点が壊れません。

### 判断 B: `A-C` overlay は direct pair diff を持ってよい

global row は adjacent chain から作ってもよいですが、`A-C` の強調は **必要なら direct diff を別途計算して投影**してよいです。  
レイアウトと比較ロジックを分けるのが肝です。

### 判断 C: inline diff の強調対象は「primary pair」を持つ

`A-B`, `B-C`, `A-C` を全部同じ強さで行内強調すると画面が破綻します。  
したがって、

- active pairs: 表示対象の集合
- primary pair: 強く強調する 1 組
- secondary pairs: 弱いマーカーで示す

の 2 層に分けることを推奨します。

---

## 8. UI / UX の推奨方針

### 8.1 表示の基本構造

```text
+---------------------------------------------------------------+
| Toolbar                                                       |
| [File] [A..C..D] [overlay preset] [primary pair] [collapse]   |
+---------------------------------------------------------------+
| Header                                                        |
|   A          |   B          |   C          |   D              |
|  rev badge   |  rev badge   |  rev badge   |  rev badge       |
+---------------------------------------------------------------+
| Single scroll container                                       |
|  row 001  | code(A) | code(B) | code(C) | code(D)            |
|  row 002  | code(A) |   ---   | code(C) | code(D)            |
|  row 003  |   ---   | code(B) | code(C) |   ---              |
|   ...                                                     ... |
+---------------------------------------------------------------+
| Minimap / overview / pair legend                              |
+---------------------------------------------------------------+
```

### 8.2 スクロール同期は「同期」ではなく「単一化」で解く

今回欲しいのは「複数 editor の scroll event を頑張って合わせること」ではありません。  
最初から **1 本の縦スクロール面**にしてしまえば、同期問題自体が消えます。

これが native editor を捨てる最大の理由です。

### 8.3 列数の増加は `window shift` ではなく horizontal scroll / virtualization で扱う

現行は pair 数が増えると `visiblePairCount` と `shift window` で対処していますが、新設計では

- revision 列はそのまま並べる
- 横幅が足りなければ水平スクロール
- 必要に応じて列 virtualization

で扱います。

つまり **「見たい revision 自体を入れ替える」操作は不要**になります。

### 8.4 N-way compare 面では native editor 互換を追いすぎない

compare viewer は読むための面です。  
そのため次のように割り切ります。

- 行クリック → native snapshot を開く
- pair action → native diff を開く
- compare viewer では readonly・軽量・安定を優先する

---

## 9. 既存資産の扱い（残す / 捨てる / 保留）

### 9.1 そのまま活かしやすいもの

| 資産 | 方針 | 理由 |
|---|---|---|
| `GitAdapter` / `SvnAdapter` / CLI 層 | 継続利用 | snapshot / history / blame 取得の責務は有効 |
| `RepositoryService` | 継続利用 | file → repo context 解決は今後も必要 |
| `RevisionPickerService` | 継続利用 | compare 対象 revision 選択にそのまま使える |
| `CacheService` / memory / persistent cache | 継続利用 | snapshot cache は今後も中核。pair / alignment cache を追加できる |
| `SnapshotFsProvider` / `UriFactory` | 補助用途で継続 | native snapshot / native diff escape hatch に使える |
| `TempSnapshotMirror` | 補助用途で継続 | compatibility fallback として価値あり |

### 9.2 大きく作り直すべきもの

| 資産 | 方針 | 理由 |
|---|---|---|
| `SessionService` | 全面作り直し | `DiffPair[]` 中心で、N-way compare の中心モデルになれない |
| `MultiDiffSession` 型 | 置き換え | `pairs` ではなく `revisions + globalAlignment + overlays` へ変える必要がある |
| `SessionMode` | 再定義 | 物理レイアウトではなく overlay preset へ意味を変えるべき |
| `CacheKey` 設計 | 拡張 | snapshot 以外に pair alignment / global alignment / inline diff cache が必要 |
| naming (`multidiff.*`) | 整理 | コマンド / 設定 namespace を `fukusa.*` に寄せたほうがよい |

### 9.3 ほぼ捨ててよいもの

| 資産 | 方針 | 理由 |
|---|---|---|
| `NativeDiffSessionController` | 廃止 | 目的そのものが pair diff の並列表示だから |
| `EditorLayoutController` | 廃止 | compare 主表示面で editor group layout を組まなくなる |
| `openSessionAdjacent` / `openSessionBase` | 置き換え | compare session 起動 + overlay preset へ再設計 |
| `shiftWindowLeft` / `shiftWindowRight` | 廃止候補 | 新しい compare surface では不要になる可能性が高い |
| `archive/Fukusa_design_v0.2.md` | archive 扱い | 「Native Editor First」が今回の要件と衝突する |

### 9.4 保留・後回しでよいもの

| 資産 | 方針 | 理由 |
|---|---|---|
| `BlameService` / `BlameDecorationController` | phase 2 以降 | compare viewer と別問題。今は N-way compare 成立が先 |
| `getDiff()` の raw unified diff | debug / validation 用 | compare の真実源にはしないが、差分検証には使える |

---

## 10. まず作るべき新しいモジュール

推奨ディレクトリ構成は次の通りです。

```text
src/
  core/
    model/
    snapshot/
    diff/
    align/
    overlay/
    inline/
    collapse/
  extension/
    adapters/
    services/
    commands/
    panels/
    snapshot/
  webview/
    compareApp/
    protocol/
    components/
    virtualGrid/
    styles/
docs/
  adr/
  spec/
  wireframes/
test/
  fixtures/
  golden/
```

### 最低限必要な新規モジュール

- `NWayCompareSessionService`
- `SnapshotLoader`
- `PairAligner`
- `AlignmentGraphBuilder`
- `PairOverlayProjector`
- `InlineDiffEngine`
- `CompareViewModelAssembler`
- `ComparePanelHost`
- `CompareWebviewProtocol`

---

## 11. MVP の切り方

### 11.1 MVP に必ず入れるもの

- 複数 revision 選択
- `A | B | C | ...` の 1 回ずつ表示
- single vertical scroll
- adjacent overlay / base overlay / custom pair
- primary pair の行内差分
- collapse unchanged
- native snapshot を開く
- native pair diff を開く

### 11.2 MVP から外してよいもの

- blame を compare viewer に重ねる
- move detection
- 言語機能の再現
- 行単位以外の semantic diff
- 永続 session restore

### 11.3 MVP 完了条件

以下が通れば「設計が正しい」と判断してよいです。

1. `A, B, C` を選ぶと **3列だけ**出る  
2. B がどこにも重複しない  
3. `A-B`, `B-C`, `A-C` を切り替えても列順と row 順が安定する  
4. 行内差分が primary pair に対して出る  
5. どの位置からスクロールしても列がずれない  
6. 行クリックから native snapshot / native diff に逃がせる

---

## 12. 実装順序の推奨

### Step 0: 現行を凍結する

- 現行 `main` を archive tag 化する
- `Native Editor First` 系の設計書を archive 扱いにする
- 新ブランチで compare viewer 再設計を始める

### Step 1: VS Code を無視して core engine を作る

最初にやるべきはここです。

- fixture `A.txt`, `B.txt`, `C.txt` を用意する
- line alignment の出力を JSON で固定する
- overlay projection の期待結果を golden 化する
- 行内差分の golden も作る

### この段階で達成すべきこと

- UI がなくても `globalRows.json` を出せる
- `overlay(A-B)`, `overlay(B-C)`, `overlay(A-C)` が計算できる
- 行内 span が計算できる

### Step 2: compare panel の骨組みだけ作る

- WebviewPanel を開く
- 固定文字列で row grid を表示する
- single scroll と sticky header を作る
- row virtualization を入れる

この段階ではまだ syntax highlight や polished styling は後回しでよいです。

### Step 3: core engine を viewer に接続する

- extension host で session 作成
- snapshot 読み込み
- alignment 計算
- view model を Webview へ渡す
- overlay toggle / primary pair 切替を実装する

### Step 4: native interop を戻す

- cell / row から snapshot を開く
- pair action から native diff を開く
- 現行の snapshot provider を補助導線として繋ぐ

### Step 5: キャッシュと大規模ファイル最適化

- snapshot cache 再利用
- pair alignment cache 追加
- global alignment cache 追加
- inline diff lazy cache 追加
- visible row chunking を導入

### Step 6: blame など周辺機能を戻す

- compare viewer 用 overlay として再設計するか
- phase 2 へ明確に分離するか

---

## 13. 設計書を作成するプラン

ここからが今回の依頼の中心です。  
実装に入る前に、以下の順番で設計書を作ることを推奨します。

### 13.1 先に ADR を 2 本書く

### ADR-001: Compare Surface Decision

**決めること**

- compare 主表示面は native diff editor ではなく custom viewer にする
- native editor は補助導線にする
- WebviewPanel を初期採用する（必要なら将来 custom editor 化できるように疎結合に保つ）

**この ADR がないと起こる問題**

- 実装中に「やっぱり native でなんとかならないか」が再発する
- viewer と native diff を中途半端に混ぜて設計がぶれる

### ADR-002: Source of Truth Decision

**決めること**

- compare の真実源は snapshot 群
- raw unified diff は補助情報
- global row alignment を独自に持つ

**この ADR がないと起こる問題**

- Git/SVN の diff text に設計を引きずられる
- overlay 切替時の layout 安定性を失う

### 13.2 次に仕様書を 5 本に分割して書く

### Spec-010: ドメインモデル仕様

**内容**

- revision
- snapshot
- line ref
- global row
- pair overlay
- inline span
- compare session

**ここで確定すること**

- 型の定義
- key の定義
- cache 単位

### Spec-020: アルゴリズム仕様

**内容**

- pair alignment
- graph 化
- topological sort
- overlay projection
- inline diff
- collapse unchanged

**ここで必ず入れるもの**

- A/B/C の worked example
- 期待 row sequence
- `A-B`, `B-C`, `A-C` の expected overlay

### Spec-030: Viewer UI / Interaction 仕様

**内容**

- header
- scroll model
- pair legend
- primary / secondary pair
- click / keyboard action
- native open 導線

**ここで確定すること**

- 何をクリックすると何が起こるか
- どこまで compare viewer が責務を持つか

### Spec-040: Extension Host / Webview Protocol 仕様

**内容**

- message types
- session init
- overlay update
- lazy inline diff request
- open native snapshot / diff action
- theme update

**ここで確定すること**

- host と viewer の境界
- chunking の方式

### Spec-050: 移行計画仕様

**内容**

- 既存機能の引越し表
- 互換コマンド
- 設定名の変更
- 既存コードの削除順

**ここで確定すること**

- どの段階で旧 `openSessionAdjacent` 系を消すか
- `multidiff.*` → `fukusa.*` の移行方針

### 13.3 最後にテスト計画書を書く

### Spec-060: Test & Fixture Plan

**最低限必要な fixture**

- 単純 insert / delete / modify
- 連続 replace
- 同一行が多いケース（曖昧一致）
- block move 相当（delete + insert 扱い）
- 空ファイル / 片側空
- CRLF / LF
- 長い行
- Unicode / 日本語コメント

**最低限必要なテスト**

- pair alignment golden
- global row golden
- overlay golden
- inline span golden
- large file smoke test

---

## 14. 具体的な執筆順（おすすめ）

迷わないために、設計書は次の順で書くのがよいです。

1. `docs/adr/001-compare-surface.md`  
2. `docs/adr/002-source-of-truth.md`  
3. `docs/spec/010-domain-model.md`  
4. `docs/spec/020-algorithm.md`  
5. `docs/spec/030-viewer-ui.md`  
6. `docs/spec/040-host-webview-protocol.md`  
7. `docs/spec/050-migration-plan.md`  
8. `docs/spec/060-test-plan.md`

### この順番を推す理由

- 最初に「何を作るか」を固定する
- 次に「何をどう表現するか」を固定する
- そのあとで UI を描く
- 一番最後に移行とテストを書く

逆順にすると、UI の雰囲気に引っ張られて core model がぶれます。

---

## 15. いまの時点での推奨意思決定

今回の再設計では、以下をこの段階で決めてしまってよいです。

### 決めてよいこと

- compare 主表示面は custom viewer にする
- layout は `1 revision = 1 column`
- `Adjacent` / `Base` は overlay preset へ意味変更する
- compare の真実源は snapshot 群にする
- global row alignment を持つ
- native snapshot / native diff は escape hatch として残す
- blame の compare 統合は phase 2 へ送る

### まだ決めなくてよいこと

- Webview のフロントエンドを React / Svelte / Vanilla のどれにするか
- syntax highlight を初版でどこまでやるか
- custom editor 化を初版からやるか、WebviewPanel で始めるか
- pair similarity の詳細閾値

---

## 16. このプランで期待できること

この方針にすると、ユーザー要求だった

- B を重複させない
- A/B/C を 1 面に並べる
- スクロールを完全同期する
- A-B / B-C / A-C を切り替える
- 行内差分を出す

が、すべて **同じ設計原理の上で**実現できます。

逆に、現行の native pair diff を延命する方向では、これらは別々のワークアラウンドになってしまい、最終的に保守不能になります。

---

## 17. 最終提案

### 提案する進め方

1. **現行 pair-first 実装は compare 表示層については延命しない**  
2. **まず core engine の黄金パターン（A/B/C fixture）を作る**  
3. **その上で custom compare viewer を作る**  
4. **既存の repo access / snapshot / cache だけを選択的に再利用する**  
5. **設計書は ADR → Domain → Algorithm → UI → Protocol → Migration → Test の順で書く**

### 一言で言うと

**Fukusa を「複数 native diff を束ねる拡張」から、「独自 N-way compare engine を持つ拡張」へ作り変える。**

これが今回の要件に対する最短経路です。

---

## 参考メモ

- 現行 README / 設計の主旨を確認したうえで、本プランではそれを意図的に反転させている
- current code の pair-first 構造 (`DiffPair[]`, `vscode.diff`, `shift window`) を前提に評価した
- VS Code の public API だけでは「1 revision = 1 column の native N-way diff surface」を得にくいため、compare surface は自前 viewer を前提にした



## 18. 参考リンク

- [Fukusa README](https://github.com/horiyamayoh/Fukusa/blob/main/README.md)
- [現行 pair-first session model (`src/application/sessionService.ts`)](https://github.com/horiyamayoh/Fukusa/blob/main/src/application/sessionService.ts)
- [現行 native diff session controller (`src/presentation/native/nativeDiffSessionController.ts`)](https://github.com/horiyamayoh/Fukusa/blob/main/src/presentation/native/nativeDiffSessionController.ts)
- [現行 layout controller (`src/presentation/native/editorLayoutController.ts`)](https://github.com/horiyamayoh/Fukusa/blob/main/src/presentation/native/editorLayoutController.ts)
- [Git CLI adapter (`src/adapters/git/gitCli.ts`)](https://github.com/horiyamayoh/Fukusa/blob/main/src/adapters/git/gitCli.ts)
- [SVN CLI adapter (`src/adapters/svn/svnCli.ts`)](https://github.com/horiyamayoh/Fukusa/blob/main/src/adapters/svn/svnCli.ts)
- [VS Code Custom Editor API](https://code.visualstudio.com/api/extension-guides/custom-editors)
- [VS Code Webview UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/webviews)
- [VS Code Built-in Commands (`vscode.diff`, `vscode.changes`)](https://code.visualstudio.com/api/references/commands)
- [GitHub issue: horizontal scroll API for TextEditor (#105625)](https://github.com/microsoft/vscode/issues/105625)
