# Fukusa Publishing Checklist

This repository uses `vsce` to build and publish VS Code extension packages.

## Prerequisites

- A verified Visual Studio Marketplace publisher account
- A personal access token configured for `vsce`
- `package.json.publisher` set to your Marketplace publisher ID

## Local Validation

Run the standard checks before publishing:

```powershell
npm install
npm run compile
npm run lint
npm test
npm run package:vsix
```

## Sign In

```powershell
npx vsce login <publisher-id>
```

Replace `<publisher-id>` with the Marketplace publisher ID you want to use.

## Publish Pre-Release

```powershell
npm run publish:prerelease
```

Or run the underlying command directly:

```powershell
npx vsce publish --pre-release
```

## Publish Release

When you are ready to promote a pre-release build:

1. Update `package.json.version`.
2. Update `CHANGELOG.md`.
3. Run `npm run compile`.
4. Run `npm run lint`.
5. Run `npm test`.
6. Run `npm run package:vsix`.
7. Run `npm run publish:release`.

## Verification Checklist

- Extension title, description, and icon look correct in Marketplace.
- README renders correctly on Marketplace.
- The package is still marked as pre-release when expected.
- The extension installs cleanly into a fresh VS Code profile.
- Core flows still work: pair diff, revision snapshot, Fukusa session, and blame heatmap.

## Local VSIX Smoke Test

Use placeholders instead of hard-coded local paths:

```powershell
$userDataDir = Join-Path $env:TEMP ('mdv-user-' + [guid]::NewGuid().ToString('N'))
$extensionsDir = Join-Path $env:TEMP ('mdv-ext-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $userDataDir, $extensionsDir | Out-Null
& '<VSCode install path>\bin\code.cmd' --install-extension .\fukusa-0.0.1.vsix --extensions-dir $extensionsDir --force
& '<VSCode install path>\Code.exe' --user-data-dir $userDataDir --extensions-dir $extensionsDir
```

Replace `<VSCode install path>` with the local VS Code installation directory on the machine you are using.

