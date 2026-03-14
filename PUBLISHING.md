# MultiDiffViewer 公開手順

このリポジトリは、`vsce` を使った Visual Studio Marketplace への手動公開を前提に整備されています。初回は pre-release 公開を想定しています。

## 事前準備

1. Visual Studio Marketplace で publisher を作成する
2. Azure DevOps で Personal Access Token を作成する
3. `package.json` の `publisher` と Marketplace 上の publisher ID を一致させる

## 公開前チェック

まずローカルで成果物を固めます。

```powershell
npm install
npm run compile
npm run lint
npm test
npm run package:vsix
```

## VSIX 確認項目

生成された `.vsix` について、最低限以下を確認します。

- `out/` が含まれている
- 実行時依存だけが含まれている
- `src/`、`.vscode-test/`、開発補助ファイルが含まれていない
- `README.md`、`CHANGELOG.md`、`LICENSE`、`media/icon.png` が含まれている

## 認証

Publisher ID が `multidiffviewer` の場合:

```powershell
npx vsce login multidiffviewer
```

Publisher ID が異なる場合は、その値に読み替えてください。`package.json.publisher` も合わせて修正が必要です。

## 初回 pre-release 公開

```powershell
npm run publish:prerelease
```

生コマンドで実行する場合:

```powershell
npx vsce publish --pre-release
```

## stable 公開へ進めるとき

pre-release の確認が終わったら、以下の順で進めます。

1. `package.json.version` を更新
2. `CHANGELOG.md` を更新
3. `npm run compile`
4. `npm run lint`
5. `npm test`
6. `npm run package:vsix`
7. `npm run publish:release`

## 公開後チェック

- Marketplace 上でタイトル、説明、リンク、README レンダリング、アイコンが崩れていない
- pre-release として表示されている
- クリーンな VS Code 環境へインストールできる
- 以下の基本フローが動く
  - pair diff
  - revision snapshot
  - MultiDiff session
  - blame heatmap

## ローカルでの公開前スモークテスト

Marketplace に出す前に、生成した VSIX をクリーン環境へ入れて試すのが安全です。

```powershell
$ud = Join-Path $env:TEMP ('mdv-user-' + [guid]::NewGuid().ToString('N'))
$ed = Join-Path $env:TEMP ('mdv-ext-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $ud,$ed | Out-Null
& 'C:\Users\dhuru\AppData\Local\Programs\Microsoft VS Code\bin\code.cmd' --install-extension .\multidiffviewer-0.0.1.vsix --extensions-dir $ed --force
& 'C:\Users\dhuru\AppData\Local\Programs\Microsoft VS Code\Code.exe' --user-data-dir $ud --extensions-dir $ed
```

この状態で、Git / SVN の両方に対して主要コマンドを試してください。
