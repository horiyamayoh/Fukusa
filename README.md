# MultiDiffViewer

MultiDiffViewer は、VS Code の native editor / native diff editor を使ってファイル履歴を多面的に追うための拡張機能です。独自 Webview に閉じず、できるだけ標準エディタの体験を継承したまま、Git / SVN の履歴 snapshot、2点 diff、複数 revision の連続比較、blame heatmap を扱えることを目標にしています。

![Pair diff session](media/session-overview.png)

## 何ができるか

通常の diff は「比較したい 2 点」が分かっているときには十分ですが、履歴調査や設計変更の追跡では「どの revision 同士を見ればよいか」がまだ分からないことが多いです。MultiDiffViewer はその前段を補うためのツールです。

- 任意 revision のファイルを readonly snapshot として開く
- 2 revision を native diff editor で比較する
- 3 つ以上の revision を adjacent / base モードで横並び表示する
- 表示中の比較 window を左右にシフトする
- blame に基づく行単位の age heatmap を重ねる
- snapshot / history / blame をキャッシュして再表示を速くする
- language feature の相性問題がある場合は temp file fallback に切り替える

## 対応リポジトリ

- Git
  - VS Code 組み込み Git API を優先
  - 必要に応じて Git CLI に fallback
- SVN
  - SVN CLI ベース

## 主なユースケース

- ある関数が「いつ」「どの差分で」大きく変わったかを追う
- 連続する複数コミットの差分を一度に眺めたい
- 現在ファイルではなく historical snapshot 単体を読みたい
- blame を見ながら古い行・新しい行の偏りを把握したい
- Git と SVN が混在する環境でも同じ操作感で履歴を見たい

## 主な機能

### 1. Readonly snapshot

履歴上のファイルを `multidiff:` 仮想ファイルシステム経由で開きます。編集はできませんが、通常のテキストエディタとして閲覧できます。

- historical snapshot を単体で確認できる
- 拡張子ベースで言語モードを解決する
- 必要に応じて `tempFile` モードへ切り替えられる

![Readonly snapshot](media/snapshot-overview.png)

### 2. Pair diff

2 つの revision を選択して、VS Code 標準の diff editor で比較します。

- inline / side-by-side は VS Code 標準機能を利用
- Command Palette と Explorer 右クリックの両方から起動可能

### 3. MultiDiff session

複数 revision を選んで、複数ペアを同時に開きます。

- `Adjacent`: `A-B`, `B-C`, `C-D` のように隣接比較
- `Base`: `A-B`, `A-C`, `A-D` のように先頭固定比較
- 表示しきれない分は window shift で切り替え

### 4. Blame heatmap

blame の日時を age bucket に分けて、行背景色・overview ruler・hover に反映します。

- 現在ファイルでも historical snapshot でも利用可能
- author / revision / date / summary を hover で表示

### 5. Cache / compatibility

- snapshot / history / blame を memory + persistent cache で保持
- `multidiff:` scheme で language feature が弱い場合は temp file fallback を利用可能

## コマンド一覧

| コマンド | 説明 |
| --- | --- |
| `MultiDiff: Open for Current File` | 現在ファイルに対して 2 revision を選び、native diff を開きます。 |
| `MultiDiff: Open for This File` | Explorer 上のファイルに対して同様の diff を開きます。 |
| `MultiDiff: Open Revision Snapshot` | 1 revision を選んで readonly snapshot を開きます。 |
| `MultiDiff: Open Session (Adjacent)` | 隣接ペアで MultiDiff session を開きます。 |
| `MultiDiff: Open Session (Base)` | 先頭固定ペアで MultiDiff session を開きます。 |
| `MultiDiff: Shift Window Left` | 表示中 session の window を左へずらします。 |
| `MultiDiff: Shift Window Right` | 表示中 session の window を右へずらします。 |
| `MultiDiff: Toggle Blame Heatmap` | blame heatmap を ON/OFF します。 |
| `MultiDiff: Warm Cache for Current File` | 現在ファイルの最近の revision を先読みします。 |
| `MultiDiff: Clear Cache for Current Repository` | 現在リポジトリのキャッシュを消します。 |
| `MultiDiff: Clear All Cache` | すべてのキャッシュを消します。 |
| `MultiDiff: Open Snapshot as Temp File` | snapshot を `file:` ベースの temp file として開きます。 |

## 設定一覧

| 設定 | 説明 |
| --- | --- |
| `multidiff.native.visiblePairCount` | 一度に表示する diff pair 数 |
| `multidiff.native.maxVisiblePairCount` | visible pair 数の上限 |
| `multidiff.blame.mode` | blame 表示モード |
| `multidiff.blame.showOverviewRuler` | overview ruler への色表示 |
| `multidiff.cache.maxSizeMb` | メモリキャッシュ上限 |
| `multidiff.snapshot.openMode` | `virtual` / `tempFile` の切り替え |
| `multidiff.compatibility.definitionFallback` | compatibility fallback の方針 |

## 使い始め方

1. Git または SVN の working copy 内にあるファイルを開きます。
2. `MultiDiff: Open for Current File` で 2 revision 比較を試します。
3. より長い履歴を見たい場合は `MultiDiff: Open Session (Adjacent)` または `MultiDiff: Open Session (Base)` を使います。
4. 行の鮮度を見たい場合は `MultiDiff: Toggle Blame Heatmap` を実行します。
5. language server の都合で定義ジャンプなどが弱い場合は `multidiff.snapshot.openMode` を `tempFile` に切り替えます。

## 動作上の前提

- Git 利用時は通常、Git CLI が利用可能であることを想定しています。
- SVN 利用時は `svn` CLI が必要です。
- readonly snapshot は `multidiff:` scheme で開くため、language extension によっては `file:` より機能が弱い場合があります。

## 既知の制約

- Definition / Hover / References の bridge provider は現状 skeleton です。実用的な fallback は temp file モードです。
- 大量の revision を一度に開く場合、VS Code の editor group 数と windowing 制約を受けます。
- binary diff や merge conflict 専用 UI は未対応です。
- すべての language extension が `multidiff:` 上で完全に動くことは保証していません。

## 開発と検証

現時点のローカル品質チェック:

- TypeScript compile
- ESLint
- unit test
- integration test
- VSIX package 作成

代表コマンド:

```powershell
npm run compile
npm run lint
npm test
npx vsce package --pre-release
```

公開手順は [PUBLISHING.md](PUBLISHING.md) を参照してください。
