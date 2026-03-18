# Fukusa 設計書（改訂版ドラフト v0.2 / Native Editor First）

> Implementation update (2026-03-15):
> 現在の実装は、この文書中の「native diff editor を pair ごとに並べる」案からさらに進めて、
> **aligned native text editor を N 本並べる N-way compare** に移行しています。
> 実コード上の主要差分は次のとおりです。
> - `pair[] + vscode.diff` ではなく `NWayCompareSession + SessionAlignmentService`
> - `Adjacent / Base` 公開 UI ではなく `Browse Revisions` からの unified compare flow
> - `multidiff:` snapshot だけでなく repo-local shadow workspace を使った historical raw file 解決
> - aligned pane 上の definition / hover / references を raw shadow file に委譲して再マップ
>
> この v0.2 文書の native-first という原則は維持しつつ、比較単位は pair ではなく pane 群へ置き換わっています。

- 作成日: 2026-03-11
- 対象: VS Code 拡張機能 **Fukusa**
- この版の位置づけ:
  - v0.1 の「Webview 主体の N-way diff」案を、**native editor / native diff editor 主体**に改めた版
  - 変更理由は、追加要件である **「VS Code の基本機能を継承して使いたい」** を最優先するため
- 文書の目的:
  - 今後の実装方針を、**Native Editor First** という明確な原則に揃える
  - 「何から作るか」と「どこで妥協するか」を、最初に固定する
  - 実装・検証・MVP・将来拡張まで一貫した設計の土台を残す

---

## 0. この改訂で何が変わったか

v0.1 からの主要変更は次の 6 点です。

1. **N-way diff の主表示面を Webview から native diff editor に変更**
2. **revision snapshot の提供方式を `TextDocumentContentProvider` 主体から `FileSystemProvider` 主体に変更**
3. **Blame ビューは引き続き native editor decoration を使うが、historical snapshot にも適用できる前提へ整理**
4. **Webview は「コード描画面」ではなく、セッション管理や補助的な overview 用に格下げ**
5. **Ctrl+クリック / Go to Definition 互換のため、language feature compatibility layer を追加**
6. **「任意の数」の解釈を、"任意個の revision を session として保持できる" に変更し、同時可視列数は VS Code の editor group 制約の中で windowing する**

この改訂により、**見た目の自由度は少し落ちる**代わりに、**syntax highlighting / hover / folding / Ctrl+クリック / 通常の editor 操作**をできるだけ VS Code 標準に寄せられます。

---

## 1. 結論

この拡張の中核設計は、以下のように定義します。

### 1.1 最重要原則

**コードを表示する場所は、できる限り Webview ではなく VS Code 標準の text editor / diff editor を使う。**

これが、この版の最も大きな結論です。

### 1.2 改訂後の主方針

1. **N-way diff は、複数の native diff editor を editor group に並べて構成する**
2. **historical snapshot は readonly の `multidiff:` スキームで公開し、VS Code には「通常のファイルのように」扱わせる**
3. **Blame は native editor に decoration / overview ruler / hover で重ねる**
4. **Git / SVN の取得とキャッシュは従来どおり adapter / cache 層で吸収する**
5. **Webview を使うとしても、コード本文の描画には使わない**
6. **Ctrl+クリック互換のため、必要に応じて custom scheme 向けの language feature bridge や temp file fallback を持つ**
7. **同時表示数は editor group 制約の範囲に収め、超過分はページング / windowing で扱う**

### 1.3 この方針の意味

この設計にすると、ユーザーが期待している

- シンタックスハイライト
- Ctrl+クリックによる定義ジャンプ
- hover
- folding
- 検索
- 標準の editor キーバインド
- 通常の diff editor の操作感

を、**拡張側で再発明せずに継承できる可能性が最も高い**です。

---

## 2. なぜ設計変更が必要なのか

### 2.1 Webview は「最後の手段」である

VS Code の UX ガイドラインでは、Webview は **native API で足りない場合にだけ**使うべきだとされています。[^webviews]

v0.1 の設計は「N 個を 1 画面で自由に並べる」という UI 目的には合っていましたが、  
今回追加された要件は **「見た目の自由さ」より「VS Code 標準 editor 機能の継承」** を優先しています。

この時点で、**Webview をコード描画の主戦場にするのは本筋ではない**と判断します。

### 2.2 FileSystemProvider は VS Code に「通常ファイルのように扱わせる」ための API である

VS Code は `FileSystemProvider` を通じて、任意ソース上のファイルやフォルダを **regular files のように扱える**ようにしています。[^fsp-regular]

また、VS Code 組み込み Git 拡張も、古いファイルバージョンの公開に `FileSystemProvider` を採用しており、  
その理由として **encoding 問題の改善**と**performance / reliability 向上**が挙げられています。[^git-fsp]

つまり、historical snapshot を VS Code 標準 editor に自然に載せたいなら、  
**`TextDocumentContentProvider` より `FileSystemProvider` の方が中長期の本命**です。

### 2.3 言語機能は core editor ではなく language extension が提供している

VS Code の syntax highlight や Go to Definition などの rich language features は、  
core editor が直接持っているのではなく、**language extensions と document selector** によって適用されます。[^lang-overview][^doc-selector]

このため、Fukusa 側が「native editor で開く」だけでは十分ではありません。  
**どの URI scheme で開くか、path / extension をどう保つか、languageId をどう与えるか**まで設計に含める必要があります。

### 2.4 editor group 数には上限がある

`showTextDocument` などで editor を開く場合、列は `ViewColumn.Nine` までが上限です。[^viewcolumn-max]

したがって、**「同時に 100 列を native editor として横並び」**は設計上できません。  
この制約の下で「任意の数」を成立させるには、

- session としては任意個の revision を保持し
- 可視部分だけを 2〜9 個の diff editor に windowing する

という形に改める必要があります。

---

## 3. 改訂後のプロダクト像

### 3.1 目指す体験

ユーザーは 1 ファイルを起点にして、

1. 複数 revision / commit / SVN revision を選ぶ
2. それらを **native diff editor の列群**として開く
3. 各列では通常の diff editor のように、syntax highlight や Ctrl+クリックを試せる
4. 同じファイルの snapshot を **native editor 単体**でも開ける
5. その editor 上で blame heatmap を表示できる
6. 一度取得した history / snapshot / diff / blame は cache され、次回は速く開ける

という体験を得ます。

### 3.2 解く課題（再整理）

- **2 個しか差分を見られない**
  - 複数の native diff editor を session として束ねる
- **NW 経由で差分取得が遅い**
  - snapshot / diff / blame を cache し、`FileSystemProvider.readFile()` 経由で瞬時に返す
- **blame の全体像が見えにくい**
  - overview ruler + whole-line decoration + hover で模様として見せる
- **VS Code 標準機能を引き継ぎたい**
  - Webview ではなく native editor surface を使う

### 3.3 非目標（初版ではやらないこと）

- custom editor で独自のコードレンダラを作ること
- Monaco を Webview 内に埋めて VS Code editor の代用品を作ること
- edit / save 可能な historical snapshot
- merge conflict 解消 UI
- binary diff / image diff
- 無制限の同時可視列（native editor を使う以上、可視 window 制限を受け入れる）

---

## 4. 要件定義（改訂版）

## 4.1 機能要件

### FR-01: Multi Revision Diff Session
- 単一ファイルに対して **2 個以上の revision** を選択できる
- session として **任意個**の revision を保持できる
- 表示モードを切り替えられる
  - adjacent: `A↔B`, `B↔C`, `C↔D`
  - base: `A↔B`, `A↔C`, `A↔D`
- 可視 window 内の pair は **native diff editor** で開かれる
- 可視 window を左右に移動できる
- 任意 revision を単体の native editor で開ける

### FR-02: Native Editor Inheritance
- snapshot / diff の表示は、可能な限り **標準 text editor / diff editor** を使う
- syntax highlighting が有効である
- Ctrl+クリック / Go to Definition を試せる
- hover / folding / search / standard keybindings を使える
- ただし実際にどこまで有効になるかは、各 language extension の scheme 対応状況に依存するため、必要なら compatibility fallback を使う

### FR-03: Blame Visualization
- ある snapshot に対する blame を native editor 上に表示できる
- whole-line decoration / overview ruler / hover を提供する
- age-based heatmap を初版とする
- 将来的に churn / authorship density も重ねられる

### FR-04: Cache
- history, snapshot, diff, blame を cache できる
- warm cache / clear cache の導線を持つ
- repo / file / all 単位で削除できる

### FR-05: Source Adapter
- Git と SVN を同一 UI で扱える
- Git は組み込み Git API 優先 + CLI fallback
- SVN は CLI ベース

## 4.2 非機能要件

### NFR-01: 表示速度
- cache hit 時は体感 1 秒未満を目標
- editor を開くたびに network access を強制しない

### NFR-02: Editor Fidelity
- 表示面で Webview に依存しない
- 標準 diff editor / text editor を優先する
- custom scheme 上で機能不足が出た場合に fallback を持つ

### NFR-03: 可視 window 制御
- 同時可視数は editor group 制約内に収める
- session 全体数と可視数を分離する

### NFR-04: Readonly Safety
- historical snapshot は読み取り専用
- 保存や accidental edit を防ぐ

### NFR-05: Theme / Accessibility
- blame 色付けは theme-aware にする
- keyboard driven にする
- high contrast でも識別可能にする

---

## 5. 改訂後の全体アーキテクチャ

```text
+-------------------------------------------------------------------+
| VS Code Commands / Menus / Tree Views                             |
| - Open Fukusa Session                                             |
| - Shift Window Left / Right                                       |
| - Open Revision Snapshot                                          |
| - Toggle Blame Heatmap                                            |
| - Warm Cache / Clear Cache                                        |
+----------------------------------+--------------------------------+
                                   |
                                   v
+-------------------------------------------------------------------+
| Application Layer                                                 |
| - SessionService                                                  |
| - NativeDiffSessionController                                     |
| - RevisionPickerService                                           |
| - BlameService                                                    |
| - CacheService                                                    |
| - LanguageFeatureCompatibilityService                             |
+--------------------------+-------------------+--------------------+
                           |                   |
                           |                   +--------------------------------+
                           |                                                    |
                           v                                                    v
+------------------------------------------+                 +------------------+------------------+
| Snapshot Transport                       |                 | Repository Adapters                  |
| - SnapshotFsProvider (readonly scheme)   |                 | - GitAdapter                         |
| - UriFactory                             |                 | - SvnAdapter                         |
| - LanguageModeResolver                   |                 | - Git CLI fallback                   |
+------------------------+-----------------+                 +------------------+------------------+
                         |                                                        |
                         v                                                        v
+------------------------------------------+                 +-------------------------------------+
| VS Code Native Surface                   |                 | Data Sources                        |
| - Text Editor                            |                 | - vscode.git API                    |
| - Diff Editor                            |                 | - git CLI                           |
| - Decorations / Overview Ruler / Hover   |                 | - svn CLI                           |
+------------------------+-----------------+                 +-------------------------------------+
                         |
                         v
+------------------------------------------+
| Cache Layer                              |
| - Memory LRU                             |
| - Persistent Snapshot Cache              |
| - Diff Cache                             |
| - Blame Cache                            |
+------------------------------------------+
```

---

## 6. 設計原則（改訂版）

### 6.1 Native Editor First
コード本文を描くのは native editor と diff editor。  
Webview は **補助 UI** に限定する。

### 6.2 Snapshot is a File
historical snapshot は「特殊な HTML 断片」ではなく、  
**VS Code が file-like に扱える resource** として公開する。

### 6.3 Session と Visible Window を分離する
session 全体では任意個の revision を持てるが、  
可視 editor は 2〜9 程度に制御する。

### 6.4 Fallback を最初から設計に入れる
language extension が custom scheme に対応していない場合があるため、  
**互換レイヤを最初から設計に含める**。

### 6.5 Cache は transport 層に自然統合する
editor が snapshot を開くときの入口は `FileSystemProvider.readFile()` に寄せる。  
これにより cache が UI 実装に漏れにくい。

---

## 7. Snapshot Transport 設計

## 7.1 `FileSystemProvider` を主採用する

historical snapshot の公開は、以下の理由で `FileSystemProvider` を主採用します。

- VS Code が arbitrary source を **regular file のように扱える**[^fsp-regular]
- 組み込み Git 拡張も older versions の公開に `FileSystemProvider` を採用済み[^git-fsp]
- readonly を provider レベルで宣言できる[^readonly-fsp]

### 7.1.1 採用 API
- `workspace.registerFileSystemProvider('multidiff', provider, { isReadonly: true })`

### 7.1.2 なぜ `TextDocumentContentProvider` ではなくこちらか
`TextDocumentContentProvider` でも readonly document は作れますが、  
本件では **「通常の editor で自然に扱わせる」**ことが重要です。

そのため最終設計では、

- **MVP 試作**: `TextDocumentContentProvider` でも可
- **本採用**: `FileSystemProvider`

とします。

## 7.2 URI 設計

### 7.2.1 例

```text
multidiff://git/<repoId>/src/foo/bar.ts?rev=abc123
multidiff://svn/<repoId>/src/foo/bar.ts?rev=18452
```

### 7.2.2 URI 設計方針
- path に **元ファイルの相対パスと拡張子**を残す
- query に `rev` を持たせる
- authority に VCS kind（`git` / `svn`）を置く
- repoId は hash 化して安定識別子にする

この形にする理由は、**拡張子や path 情報が language detection に効く余地を残す**ためです。

## 7.3 LanguageModeResolver

snapshot を開いた時に language mode が plain text になるのを避けるため、  
必要に応じて `setTextDocumentLanguage(document, languageId)` を使います。[^set-language]

### 7.3.1 言語決定順
1. 元の workspace file の `languageId`
2. path / extension から推定
3. 失敗時は plain text

### 7.3.2 目的
- syntax highlighting
- bracket matching
- comment toggling
- folding
- language-specific editor behaviors

をできるだけ維持する。

## 7.4 `SnapshotFsProvider.readFile()` の役割

`readFile(uri)` は単なる bytes 返却ではなく、実質的に **snapshot cache gateway** です。

### 処理フロー
1. URI を parse
2. cache key を生成
3. memory cache を見る
4. persistent cache を見る
5. miss の場合は RepositoryAdapter から取得
6. cache 保存
7. bytes を返す

これにより、UI 層は「どこから取るか」を意識せず、  
**resource を開くだけで速くなる**設計になります。

---

## 8. N-way Diff の新設計（Native Diff Session）

## 8.1 発想の切り替え

v0.1 では **1 枚の Webview に N 列のコード本文を描く**想定でした。  
v0.2 では **N-way diff = 複数の native diff editor の session** と定義し直します。

これは見た目としては、

- 1 つの custom viewer
ではなく、
- 複数の built-in diff editor を extension が束ねる

イメージです。

### 8.1.1 この再定義の利点
- 各 pair 比較は built-in diff editor が担当する
- syntax highlighting を引き継ぎやすい
- Ctrl+クリック / hover / find / folding などが期待しやすい
- 自前実装すべき diff renderer が激減する

### 8.1.2 代償
- 1 revision が複数 pair に重複して現れる（adjacent mode で B が左右に出る）
- 可視列数に上限がある
- 完全自由な multi-column レイアウトは捨てる

しかし今回の追加要件では、この trade-off は妥当です。

## 8.2 Compare Mode

### Adjacent Mode
選択 revision が `[A, B, C, D]` のとき、開く pair は:

- `A↔B`
- `B↔C`
- `C↔D`

これは「変更を時系列に追う」ための主モードです。

### Base Mode
選択 revision が `[A, B, C, D]` のとき、開く pair は:

- `A↔B`
- `A↔C`
- `A↔D`

これは「基準 revision から何が変わったか」を見るためのモードです。

## 8.3 Visible Window

editor group 数の上限があるため、session と visible window を分けます。[^viewcolumn-max][^set-layout]

### 8.3.1 定義
- `sessionRevisions`: ユーザーが選んだ全 revision
- `visiblePairs`: 現在 editor に展開している pair 群

### 8.3.2 例
`A, B, C, D, E, F, G` を選んだ場合

- session 全体: 7 revision
- adjacent pair: 6
- visible window size: 3 pair

なら、最初に表示するのは

- `A↔B`
- `B↔C`
- `C↔D`

で、  
「次へ」で

- `D↔E`
- `E↔F`
- `F↔G`

に切り替える。

### 8.3.3 利点
- 任意個の revision を選べる
- 一度に開きすぎて editor area が崩れない
- native editor 前提でも、実用上の「N-way」を維持できる

## 8.4 レイアウト制御

### 採用 API
- `vscode.setEditorLayout`[^set-layout]
- `vscode.diff(left, right, title, options)`[^diff-command]

### 基本戦略
1. visible pair 数 `k` を決める
2. `setEditorLayout` で横並び `k` group を作る
3. 各 group に `vscode.diff()` を投げる
4. preview は切り、session の各 pair を tab として固定する

### 例
3 pair 表示なら 3 group を横並びに作る。

## 8.5 NativeDiffSessionController

責務:
- session から visible pair を計算する
- editor layout を組む
- 各 pair を diff editor として開く
- 左右ウィンドウ移動、再描画、再オープンを管理する

### 想定 API
```ts
interface NativeDiffSessionController {
  openSession(input: MultiDiffSessionInput): Promise<void>;
  shiftWindow(sessionId: string, delta: number): Promise<void>;
  reopenPair(sessionId: string, pairIndex: number): Promise<void>;
  focusPair(sessionId: string, pairIndex: number): Promise<void>;
  closeSession(sessionId: string): Promise<void>;
}
```

## 8.6 スクロールとナビゲーション

### v1 の方針
- **pair 内の左右同期**は built-in diff editor に任せる
- **pair 間の同期スクロール**は MVP では必須にしない
- session 全体の移動は command ベースにする

### 理由
pair 間まで完全同期を狙うと、native diff editor の内部状態との相互制御が難しくなり、  
初学者向けの最初の拡張としては難度が上がりすぎます。

### v2 で検討するもの
- active pair の visible range に応じて他 pair を `revealRange()` で追従させる[^visible-ranges][^reveal-range]
- hunk 単位の session navigation
- session minimap

---

## 9. Blame ビュー設計（native editor 維持）

## 9.1 表示対象
- 現在の workspace file (`file:`)
- historical snapshot (`multidiff:`)

のどちらにも blame を適用可能にします。

## 9.2 表示方法
- `createTextEditorDecorationType()` で whole-line 背景[^decorations]
- `overviewRulerLane` を使った全体模様[^overview-ruler]
- hover text で revision / author / date / summary

### 表示イメージ
- 新しい行ほど目立つ
- 古い行ほど落ち着いた表示
- ファイル右端の overview ruler で「どこが最近触られたか」が一目で分かる

## 9.3 heatmap の意味付け
blame は defect predictor ではないため、  
文言は次のように整理します。

- `stability hint`
- `recently changed`
- `older / newer lines`
- `high churn area`（将来）

**「バグがある」ではなく「最近よく動いた領域かどうか」**を示す UI にします。

## 9.4 native editor を使う利点
Blame ビューが Webview ではなく標準 editor 上に載るため、

- syntax highlight
- folding
- Ctrl+クリック
- file 検索
- editor keybindings

を維持しやすいです。

---

## 10. Language Feature Compatibility Layer

## 10.1 なぜ必要か

VS Code の language features は document selector で適用対象が決まります。[^doc-selector]

つまり、ある拡張が

```ts
{ scheme: 'file', language: 'typescript' }
```

のように selector を絞っている場合、  
`multidiff:` URI では自動的に同じ機能が付くとは限りません。

したがって、**「native editor で開けば必ず Ctrl+クリックできる」**とまでは言えません。  
ここは設計上、最初から正直に扱うべきです。

## 10.2 基本戦略

### レイヤ 1: まずは素直に native resource として開く
- `FileSystemProvider`
- path に元の拡張子
- `setTextDocumentLanguage`

これで動く language extension はそのまま使う。

### レイヤ 2: compatibility mode を用意する
設定で次を切り替え可能にする。

- `virtual`（既定）: `multidiff:` のまま開く
- `tempFile`（互換重視）: 一時 mirror file を作って `file:` として開く

#### `tempFile` の意図
- `scheme: 'file'` 前提の language extension に寄せる
- Ctrl+クリックや参照解決の成功率を上げる

#### 欠点
- temp file の管理が必要
- diagnostics が temp path に出る場合がある
- 検索対象や workspace との関係に注意が必要

## 10.3 Go to Definition fallback（設計上の保険）

VS Code は `registerDefinitionProvider()` で custom scheme 向け provider を登録でき、[^register-definition]
`vscode.executeDefinitionProvider` で既存 provider を呼び出せます。[^execute-definition]

そのため v2 以降では、次の fallback を実装可能です。

1. `multidiff:` document 上で Ctrl+クリック
2. Fukusa 独自の DefinitionProvider が受ける
3. 必要なら temp mirror file を用意する
4. その mirror file に対して `vscode.executeDefinitionProvider` を実行する
5. 結果 Location をそのまま、または `multidiff:` に再マッピングして返す

### 10.3.1 初版での現実的な優先順位
- **優先 1**: まず native diff editor / snapshot editor でそのまま効くか試す
- **優先 2**: 効かない言語だけ tempFile mode を用意する
- **優先 3**: 本当に必要になったら bridge provider を作る

初版から万能な bridge を作る必要はありません。  
ただし、設計上の逃げ道としては持っておきます。

---

## 11. Webview の位置づけ（改訂後）

## 11.1 初版での扱い
Webview は **コード本文を描画しない**前提に変更します。

### 用途候補
- session summary
- revision timeline
- cache overview
- blame distribution summary
- future の heatmap dashboard

## 11.2 使わない用途
- multi-column code body rendering
- native diff editor の代替
- syntax highlighting / Ctrl+クリックの再実装

## 11.3 位置づけ
Webview は **optional auxiliary surface** です。  
主役ではありません。

---

## 12. Git / SVN 取得層（基本は据え置き）

## 12.1 GitAdapter
方針は v0.1 を維持します。

- 組み込み Git API を優先
- 足りない部分だけ Git CLI fallback
- arbitrary revision blame は CLI fallback を許容

## 12.2 SvnAdapter
- `svn info`
- `svn log`
- `svn cat`
- `svn diff`
- `svn blame`

を CLI で扱う方針を維持します。

## 12.3 取得層が native UI にどう繋がるか
取得結果は最終的に

- snapshot bytes → `FileSystemProvider`
- blame lines → `DecorationController`
- session pairs → `NativeDiffSessionController`

に流れるため、  
UI が Git / SVN 差異を意識しなくて済みます。

---

## 13. Cache 設計（native editor 化に合わせた整理）

## 13.1 cache 種別
1. history cache
2. snapshot cache
3. diff cache
4. blame cache

## 13.2 重要な変更点
v0.1 では Webview 描画用 DTO への最適化が色濃かったですが、  
v0.2 では **snapshot cache を最上流の中心**に置きます。

### 理由
native diff editor は最終的に「left URI」「right URI」を開くだけでよく、  
その背後で `readFile()` が高速に返ればよいからです。

## 13.3 warm の単位
- 現在 file の recent revisions
- session 全体
- blame
- visible window 周辺の pair

## 13.4 clear の単位
- current file
- current repo
- all
- expired only

---

## 14. package.json / Contribution 設計

## 14.1 基本方針
- `extensionKind: ["workspace"]`
- `extensionDependencies: ["vscode.git"]`
- custom editor / webview panel は必須にしない
- tree view + commands + editor actions を主導線にする

## 14.2 主要コマンド案

```text
multidiff.openForCurrentFile
multidiff.openForExplorerFile
multidiff.openSessionAdjacent
multidiff.openSessionBase
multidiff.shiftWindowLeft
multidiff.shiftWindowRight
multidiff.openRevisionSnapshot
multidiff.toggleBlameHeatmap
multidiff.cache.warmCurrentFile
multidiff.cache.clearCurrentRepo
multidiff.cache.clearAll
multidiff.compatibility.openSnapshotAsTempFile
```

## 14.3 設定項目案

```jsonc
{
  "multidiff.presentation.mode": "native",
  "multidiff.native.visiblePairCount": 3,
  "multidiff.native.maxVisiblePairCount": 6,
  "multidiff.snapshot.openMode": "virtual",
  "multidiff.compatibility.definitionFallback": "auto",
  "multidiff.cache.maxSizeMb": 512,
  "multidiff.cache.prefetchRecentRevisionCount": 20,
  "multidiff.blame.mode": "age",
  "multidiff.blame.showOverviewRuler": true
}
```

### 補足
- `presentation.mode` の既定値は `native`
- 将来 `experimentalWebviewOverview` を足しても、既定は変えない

---

## 15. ディレクトリ構成案（改訂版）

```text
fukusa/
  src/
    extension.ts

    commands/
      openForCurrentFile.ts
      openForExplorerFile.ts
      openSessionAdjacent.ts
      openSessionBase.ts
      shiftWindowLeft.ts
      shiftWindowRight.ts
      openRevisionSnapshot.ts
      toggleBlameHeatmap.ts
      warmCache.ts
      clearCache.ts
      openSnapshotAsTempFile.ts

    application/
      sessionService.ts
      revisionPickerService.ts
      blameService.ts
      cacheService.ts
      languageFeatureCompatibilityService.ts

    adapters/
      common/
        repositoryAdapter.ts
        types.ts
      git/
        gitAdapter.ts
        gitApi.ts
        gitCli.ts
      svn/
        svnAdapter.ts
        svnCli.ts

    infrastructure/
      fs/
        snapshotFsProvider.ts
        uriFactory.ts
        languageModeResolver.ts
      cache/
        memoryCache.ts
        persistentCache.ts
        cacheKeys.ts
      temp/
        tempSnapshotMirror.ts

    presentation/
      native/
        nativeDiffSessionController.ts
        editorLayoutController.ts
      decorations/
        blameDecorationController.ts
      views/
        sessionsTreeProvider.ts
        cacheTreeProvider.ts

    compatibility/
      definitionBridgeProvider.ts
      hoverBridgeProvider.ts
      referenceBridgeProvider.ts

    util/
      hash.ts
      disposable.ts
      output.ts

    test/
      unit/
      integration/
```

---

## 16. データモデル案（改訂版）

```ts
export interface RepoContext {
  kind: 'git' | 'svn';
  repoRoot: string;
  repoId: string;
  displayName: string;
}

export interface RevisionRef {
  id: string;
  shortId: string;
  author?: string;
  date?: string;
  message?: string;
  order: number;
}

export interface SnapshotResource {
  uri: vscode.Uri;
  repo: RepoContext;
  relativePath: string;
  revision: RevisionRef;
  languageId?: string;
}

export interface DiffPair {
  left: SnapshotResource | vscode.Uri;
  right: SnapshotResource | vscode.Uri;
  title: string;
  pairIndex: number;
}

export interface MultiDiffSession {
  sessionId: string;
  repo: RepoContext;
  relativePath: string;
  revisions: RevisionRef[];
  compareMode: 'adjacent' | 'base';
  visibleStartPairIndex: number;
  visiblePairCount: number;
}
```

---

## 17. 実装ステップ（改訂版）

## Milestone 0: 拡張の骨組み
### ゴール
- F5 で起動
- Command Palette から現在ファイル URI を取得

## Milestone 1: Readonly snapshot を native editor で開く
### ゴール
- `multidiff:` URI を `FileSystemProvider` で公開
- arbitrary revision snapshot を標準 editor で開ける

### やること
1. `registerFileSystemProvider`
2. URI parser
3. GitAdapter の `getSnapshot`
4. `readFile()` 実装
5. `showTextDocument(snapshotUri)`
6. `setTextDocumentLanguage` で言語モード補正

> ここでまず「historical code を標準 editor で開く」成功体験を作る。  
> この時点で Webview は不要。

## Milestone 2: Pair diff を native diff editor で開く
### ゴール
- 現在ファイル or revision snapshot の pair diff を `vscode.diff` で開ける

### やること
1. revision 1 件選択
2. left / right URI 構築
3. `vscode.diff(left, right, title, options)`

> ここまでで「標準 diff editor を自分の拡張から操る」基礎が完成する。

## Milestone 3: Fukusa Session
### ゴール
- 3 pair 程度を横並びで開ける

### やること
1. 複数 revision 選択
2. adjacent / base pair 生成
3. `setEditorLayout`
4. 各 group に `vscode.diff` を開く
5. session tree を作る
6. next / prev window コマンドを作る

> v0.1 の Webview multi-column より先に、こちらを完成させる。

## Milestone 4: Blame heatmap
### ゴール
- current file / snapshot に blame を重ねる

### やること
1. blame 取得
2. age bucket 化
3. decoration 作成
4. overview ruler 表示
5. hover

## Milestone 5: Cache
### ゴール
- 2 回目が速いことを体感できる

### やること
1. memory cache
2. persistent cache
3. readFile 経由統合
4. warm / clear commands

## Milestone 6: SVN support
### ゴール
- Git と同じ native UI で SVN も動く

## Milestone 7: Compatibility fallback
### ゴール
- `multidiff:` で definition が弱い言語に対処する

### やること
1. temp snapshot mirror
2. open-as-temp-file command
3. 必要なら DefinitionProvider bridge

## Milestone 8: 補助 UI（必要なら）
### ゴール
- Session summary や blame overview を補助表示する

### やること
- Tree View 充実
- optional Webview overview

---

## 18. 初学者向けの「最初に触る順番」

初めての VS Code 拡張開発なら、順番は必ずこうします。

1. コマンド
2. `FileSystemProvider`
3. snapshot を text editor で開く
4. `vscode.diff`
5. `setEditorLayout`
6. blame decoration
7. cache
8. SVN
9. compatibility fallback
10. optional Webview

### この順番が良い理由
- 「native editor を開く」ことが、今回の要求の核心だから
- Webview より先に editor surface の理解が必要だから
- pair diff まで動けば、それだけで価値が出るから

---

## 19. リスクと対策（改訂版）

## R-01: custom scheme では一部 language features が効かない
### 背景
language extension 側が `scheme: 'file'` に絞っている可能性がある。[^doc-selector]

### 対策
- path と extension を維持する
- `setTextDocumentLanguage`
- tempFile compatibility mode
- 必要なら DefinitionProvider bridge

## R-02: 同時可視数に上限がある
### 背景
editor columns は `ViewColumn.Nine` が上限。[^viewcolumn-max]

### 対策
- session と visible window を分離
- default visible pair count は 3
- over-limit 時は next / prev window

## R-03: adjacent mode では中央 revision が重複表示される
### 背景
`A↔B`, `B↔C` のように middle revision が複数 pair に現れる

### 対策
- これは native diff editor 継承のための意図的 trade-off と明示する
- 任意 revision 単体を snapshot editor で開くコマンドを用意する

## R-04: temp file fallback が煩雑
### 背景
互換性のための temp mirror は cleanup や diagnostics の問題を持つ

### 対策
- 既定は `virtual`
- 問題のある言語だけ `tempFile` を有効化
- temp path は extension storage 配下に限定し、clear command を持つ

## R-05: pair 間同期スクロールが弱い
### 背景
native diff editor を複数束ねるため、Webview のような完全統制はしづらい

### 対策
- MVP では pair 内同期だけで十分と割り切る
- v2 で visible range 追従を試す

---

## 20. この設計での MVP

### MVP の定義
次の 5 条件を満たしたら、最初の公開候補にできます。

1. Git の現在ファイルで history を複数選択できる
2. 3 pair 以上を native diff editor で横並びに開ける
3. historical snapshot を単体の native editor で開ける
4. snapshot 上に blame heatmap を表示できる
5. 主要対象言語で、少なくとも syntax highlighting と Ctrl+クリックの検証が完了している

### 補足
最後の 5 は「全言語で保証」ではありません。  
**自分の現場で本当に使う言語**を優先して acceptance test に入れるべきです。

---

## 21. 受け入れ基準（追加）

## AC-NATIVE-01
snapshot を開いた時、**Webview ではなく標準 text editor** で開く

## AC-NATIVE-02
pair compare は **標準 diff editor** で開く

## AC-NATIVE-03
snapshot に対して blame decoration を重ねても、通常の editor 操作が壊れない

## AC-NATIVE-04
対象言語で syntax highlighting が有効

## AC-NATIVE-05
対象言語で Ctrl+クリックがそのまま動く、または compatibility mode で動く

## AC-NATIVE-06
visible window を切り替えても session 情報が失われない

---

## 22. 最終提案

今回の追加要件を入れるなら、  
**v0.1 の Webview 主体案のまま進むべきではありません。**

設計変更は必要です。  
ただし、それは悪いことではなく、むしろ方向性がより明確になったと考えるべきです。

### 改訂後の一言での方針
**「Fukusa は、独自描画の diff viewer ではなく、VS Code 標準 editor / diff editor を束ねる履歴閲覧オーケストレータとして作る」**

これなら、

- あなたが欲しい **N 個の差分追跡**
- **高速表示のためのキャッシュ**
- **模様として読める blame**
- そして今回追加された **VS Code 標準機能の継承**

を、1 本の設計で両立しやすくなります。

---

## 23. 参考資料

[^webviews]: VS Code UX Guidelines - Webviews. Webview は native API で足りない場合だけ使うべきとされている。<https://code.visualstudio.com/api/ux-guidelines/webviews>
[^fsp-regular]: VS Code 1.23 release notes - FileSystem Providers. arbitrary source の files/folders を VS Code が regular files のように扱える。<https://code.visualstudio.com/updates/v1_23>
[^git-fsp]: VS Code 1.41 release notes - Git: Adoption of FileSystemProvider. 組み込み Git 拡張は older versions の公開に `FileSystemProvider` を採用し、performance / reliability を改善している。<https://code.visualstudio.com/updates/v1_41>
[^lang-overview]: VS Code Language Extensions Overview. syntax highlight や Go to Definition などの言語機能は language extensions が担う。<https://code.visualstudio.com/api/language-extensions/overview>
[^doc-selector]: VS Code Document Selectors. language features は language / scheme / pattern で適用対象が決まる。<https://code.visualstudio.com/api/references/document-selector>
[^viewcolumn-max]: VS Code API. `showTextDocument` で作られる column は `ViewColumn.Nine` まで。<https://code.visualstudio.com/api/references/vscode-api>
[^readonly-fsp]: VS Code API. `registerFileSystemProvider(..., { isReadonly: true })` と readonly file system の扱い。<https://code.visualstudio.com/api/references/vscode-api>
[^set-language]: VS Code API. `setTextDocumentLanguage(document, languageId)` で document の language を変更できる。<https://code.visualstudio.com/api/references/vscode-api>
[^diff-command]: VS Code Built-in Commands. `vscode.diff(left, right, title, options)` で diff editor を開ける。<https://code.visualstudio.com/api/references/commands>
[^set-layout]: VS Code 1.25 release notes. `vscode.setEditorLayout` で editor group layout を構成できる。<https://code.visualstudio.com/updates/v1_25>
[^visible-ranges]: VS Code API. `onDidChangeTextEditorVisibleRanges`。editor の visible range 変化を監視できる。<https://code.visualstudio.com/api/references/vscode-api>
[^reveal-range]: VS Code API. `TextEditor.revealRange(range, revealType)`。範囲を表示位置に reveal できる。<https://code.visualstudio.com/api/references/vscode-api>
[^decorations]: VS Code API. `createTextEditorDecorationType` による editor decoration。<https://code.visualstudio.com/api/references/vscode-api>
[^overview-ruler]: VS Code API. `OverviewRulerLane` により overview ruler へ表示できる。<https://code.visualstudio.com/api/references/vscode-api>
[^register-definition]: VS Code API. `registerDefinitionProvider(selector, provider)`。custom scheme 向け definition provider を登録できる。<https://code.visualstudio.com/api/references/vscode-api>
[^execute-definition]: VS Code Built-in Commands / Commands guide. `vscode.executeDefinitionProvider` で既存 definition provider を実行できる。<https://code.visualstudio.com/api/references/commands> / <https://code.visualstudio.com/api/extension-guides/command>
