import * as assert from 'assert';
import * as path from 'path';

import { publicConfigurationSettings } from '../../configuration/extensionConfiguration';

suite('Unit: package contributions', () => {
  test('exposes the streamlined command and view surface', async () => {
    const packageJson = await import(path.resolve(__dirname, '../../../package.json'));
    const commands = (packageJson.default?.contributes?.commands ?? packageJson.contributes?.commands) as Array<{
      command: string;
      enablement?: string;
    }>;
    const views = (packageJson.default?.contributes?.views ?? packageJson.contributes?.views) as {
      explorer: Array<{ id: string }>;
    };
    const menus = (packageJson.default?.contributes?.menus ?? packageJson.contributes?.menus) as {
      commandPalette: Array<{ command: string; when?: string }>;
      'view/item/context': Array<{ command: string; when?: string }>;
      'explorer/context': Array<{ command: string; when?: string; group?: string }>;
    };
    const keybindings = (packageJson.default?.contributes?.keybindings ?? packageJson.contributes?.keybindings) as Array<{
      command: string;
      key: string;
      when?: string;
    }>;
    const configuration = (packageJson.default?.contributes?.configuration ?? packageJson.contributes?.configuration) as {
      properties: Record<string, { default?: unknown; enum?: readonly unknown[] }>;
    };

    assert.ok(commands.some((entry) => entry.command === 'multidiff.browseRevisions'));
    assert.ok(commands.some((entry) => entry.command === 'multidiff.browseRevisionsSingleTab'));
    assert.ok(commands.some((entry) => entry.command === 'multidiff.changePairProjection'));
    assert.ok(commands.some((entry) => (
      entry.command === 'multidiff.changePairProjection'
      && entry.enablement === 'multidiff.canChangePairProjection'
    )));
    assert.ok(commands.some((entry) => entry.command === 'multidiff.switchCompareSurface'));
    assert.ok(commands.some((entry) => (
      entry.command === 'multidiff.switchCompareSurface'
      && entry.enablement === 'multidiff.hasActiveSession'
    )));
    assert.ok(commands.some((entry) => (
      entry.command === 'multidiff.shiftWindowLeft'
      && entry.enablement === 'multidiff.canShiftWindowLeft'
    )));
    assert.ok(commands.some((entry) => (
      entry.command === 'multidiff.shiftWindowRight'
      && entry.enablement === 'multidiff.canShiftWindowRight'
    )));
    assert.ok(commands.some((entry) => entry.command === 'multidiff.closeActiveSession'));
    assert.ok(commands.some((entry) => entry.command === 'multidiff.expandAllCollapsedGaps'));
    assert.ok(commands.some((entry) => entry.command === 'multidiff.openActiveSessionSnapshot'));
    assert.ok(commands.some((entry) => entry.command === 'multidiff.openActiveSessionPairDiff'));
    assert.ok(commands.some((entry) => entry.command === 'multidiff.resetExpandedGaps'));
    assert.ok(commands.some((entry) => entry.command === 'multidiff.internal.revealSession'));
    assert.ok(commands.some((entry) => entry.command === 'multidiff.internal.changePairProjection'));
    assert.ok(commands.some((entry) => entry.command === 'multidiff.internal.closeSession'));
    assert.ok(commands.some((entry) => entry.command === 'multidiff.internal.expandAllCollapsedGaps'));
    assert.ok(commands.some((entry) => entry.command === 'multidiff.internal.openSessionPairDiff'));
    assert.ok(commands.some((entry) => entry.command === 'multidiff.internal.openSessionSnapshot'));
    assert.ok(commands.some((entry) => entry.command === 'multidiff.internal.resetExpandedGaps'));
    assert.ok(commands.some((entry) => entry.command === 'multidiff.internal.scrollAlignedUp'));
    assert.ok(commands.some((entry) => entry.command === 'multidiff.internal.scrollAlignedDown'));
    assert.ok(commands.some((entry) => entry.command === 'multidiff.internal.shiftWindowLeft'));
    assert.ok(commands.some((entry) => entry.command === 'multidiff.internal.shiftWindowRight'));
    assert.ok(commands.some((entry) => entry.command === 'multidiff.internal.switchCompareSurface'));
    assert.ok(commands.some((entry) => entry.command === 'multidiff.internal.toggleCollapseUnchanged'));
    assert.ok(commands.some((entry) => (
      entry.command === 'multidiff.expandAllCollapsedGaps'
      && entry.enablement === 'multidiff.collapseUnchangedActive && multidiff.hasCollapsedGaps'
    )));
    assert.ok(commands.some((entry) => (
      entry.command === 'multidiff.resetExpandedGaps'
      && entry.enablement === 'multidiff.collapseUnchangedActive && multidiff.hasExpandedGaps'
    )));
    assert.ok(menus.commandPalette.some((entry) => (
      entry.command === 'multidiff.internal.revealSession'
      && entry.when === 'false'
    )));
    assert.ok(menus.commandPalette.some((entry) => (
      entry.command === 'multidiff.internal.changePairProjection'
      && entry.when === 'false'
    )));
    assert.ok(menus.commandPalette.some((entry) => (
      entry.command === 'multidiff.internal.expandAllCollapsedGaps'
      && entry.when === 'false'
    )));
    assert.ok(menus.commandPalette.some((entry) => (
      entry.command === 'multidiff.internal.openSessionPairDiff'
      && entry.when === 'false'
    )));
    assert.ok(menus.commandPalette.some((entry) => (
      entry.command === 'multidiff.internal.openSessionSnapshot'
      && entry.when === 'false'
    )));
    assert.ok(menus.commandPalette.some((entry) => (
      entry.command === 'multidiff.internal.resetExpandedGaps'
      && entry.when === 'false'
    )));
    assert.ok(menus.commandPalette.some((entry) => (
      entry.command === 'multidiff.internal.scrollAlignedUp'
      && entry.when === 'false'
    )));
    assert.ok(menus.commandPalette.some((entry) => (
      entry.command === 'multidiff.internal.scrollAlignedDown'
      && entry.when === 'false'
    )));
    assert.ok(menus.commandPalette.some((entry) => (
      entry.command === 'multidiff.internal.shiftWindowLeft'
      && entry.when === 'false'
    )));
    assert.ok(menus.commandPalette.some((entry) => (
      entry.command === 'multidiff.internal.shiftWindowRight'
      && entry.when === 'false'
    )));
    assert.ok(menus['view/item/context'].some((entry) => (
      entry.command === 'multidiff.internal.revealSession'
      && entry.when === 'view == multidiff.sessions && viewItem =~ /(^| )session( |$)/'
    )));
    assert.ok(menus['view/item/context'].some((entry) => (
      entry.command === 'multidiff.internal.switchCompareSurface'
      && entry.when === 'view == multidiff.sessions && viewItem =~ /(^| )session( |$)/'
    )));
    assert.ok(menus['view/item/context'].some((entry) => (
      entry.command === 'multidiff.internal.closeSession'
      && entry.when === 'view == multidiff.sessions && viewItem =~ /(^| )session( |$)/'
    )));
    assert.ok(menus['view/item/context'].some((entry) => (
      entry.command === 'multidiff.internal.changePairProjection'
      && entry.when?.includes('pair-projectable')
    )));
    assert.ok(menus['view/item/context'].some((entry) => (
      entry.command === 'multidiff.internal.openSessionSnapshot'
      && entry.when === 'view == multidiff.sessions && viewItem =~ /(^| )session( |$)/ && viewItem =~ /(^| )has-active-snapshot( |$)/'
    )));
    assert.ok(menus['view/item/context'].some((entry) => (
      entry.command === 'multidiff.internal.openSessionPairDiff'
      && entry.when === 'view == multidiff.sessions && viewItem =~ /(^| )session( |$)/ && viewItem =~ /(^| )has-active-pair( |$)/'
    )));
    assert.ok(menus['view/item/context'].some((entry) => (
      entry.command === 'multidiff.internal.toggleCollapseUnchanged'
      && entry.when === 'view == multidiff.sessions && viewItem =~ /(^| )session( |$)/'
    )));
    assert.ok(menus['view/item/context'].some((entry) => (
      entry.command === 'multidiff.internal.shiftWindowLeft'
      && entry.when?.includes('can-shift-window-left')
    )));
    assert.ok(menus['view/item/context'].some((entry) => (
      entry.command === 'multidiff.internal.shiftWindowRight'
      && entry.when?.includes('can-shift-window-right')
    )));
    assert.ok(menus['view/item/context'].some((entry) => (
      entry.command === 'multidiff.internal.expandAllCollapsedGaps'
      && entry.when?.includes('has-collapsed-gaps')
    )));
    assert.ok(menus['view/item/context'].some((entry) => (
      entry.command === 'multidiff.internal.resetExpandedGaps'
      && entry.when?.includes('has-expanded-gaps')
    )));
    assert.ok(menus['view/item/context'].some((entry) => (
      entry.command === 'multidiff.internal.openSessionSnapshot'
      && entry.when === 'view == multidiff.sessions && viewItem == snapshot'
    )));
    assert.ok(menus['explorer/context'].some((entry) => (
      entry.command === 'multidiff.browseRevisions'
      && entry.group === '3_compare@1'
      && entry.when === 'resourceScheme == file'
    )));
    assert.ok(menus['explorer/context'].some((entry) => (
      entry.command === 'multidiff.browseRevisionsSingleTab'
      && entry.group === '3_compare@2'
      && entry.when === 'resourceScheme == file'
    )));
    assert.ok(keybindings.some((entry) => (
      entry.command === 'multidiff.internal.scrollAlignedUp'
      && entry.key === 'ctrl+up'
      && entry.when === 'resourceScheme == multidiff-session-doc && editorTextFocus'
    )));
    assert.ok(keybindings.some((entry) => (
      entry.command === 'multidiff.internal.scrollAlignedDown'
      && entry.key === 'ctrl+down'
      && entry.when === 'resourceScheme == multidiff-session-doc && editorTextFocus'
    )));
    assert.ok(!commands.some((entry) => entry.command === 'multidiff.openForCurrentFile'));
    assert.ok(!commands.some((entry) => entry.command === 'multidiff.openForExplorerFile'));
    assert.ok(!commands.some((entry) => entry.command === 'multidiff.openRevisionSnapshot'));
    assert.ok(!commands.some((entry) => entry.command === 'multidiff.openSessionAdjacent'));
    assert.ok(!commands.some((entry) => entry.command === 'multidiff.openSessionBase'));
    assert.ok(!commands.some((entry) => entry.command === 'multidiff.compatibility.openSnapshotAsTempFile'));
    assert.deepStrictEqual(views.explorer.map((entry) => entry.id), ['multidiff.sessions', 'multidiff.cache']);
    for (const setting of publicConfigurationSettings) {
      const property = configuration.properties[setting.key];
      assert.ok(property, `missing configuration contribution for ${setting.key}`);
      assert.strictEqual(property.default, setting.defaultValue, `unexpected default for ${setting.key}`);
      if ('enumValues' in setting) {
        assert.deepStrictEqual(property.enum, setting.enumValues, `unexpected enum for ${setting.key}`);
      }
    }
    assert.ok(!('multidiff.compatibility.definitionFallback' in configuration.properties));
    assert.ok(!('multidiff.native.visiblePaneCount' in configuration.properties));
    assert.ok(!('multidiff.native.maxVisiblePaneCount' in configuration.properties));
    assert.ok(!('multidiff.compare.defaultPairMode' in configuration.properties));
  });
});
