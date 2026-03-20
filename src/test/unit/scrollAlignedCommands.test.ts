import * as assert from 'assert';
import * as sinon from 'sinon';

import { CommandContext } from '../../commands/commandContext';
import { createScrollAlignedDownCommand, createScrollAlignedUpCommand } from '../../commands/scrollAligned';

suite('Unit: scrollAligned commands', () => {
  teardown(() => {
    sinon.restore();
  });

  test('routes Ctrl+Up to aligned native scrolling', async () => {
    const scrollActiveEditorAlignedStub = sinon.stub().resolves(true);

    await createScrollAlignedUpCommand(createContext(scrollActiveEditorAlignedStub))();

    assert.strictEqual(scrollActiveEditorAlignedStub.callCount, 1);
    assert.deepStrictEqual(scrollActiveEditorAlignedStub.firstCall.args, [-1]);
  });

  test('routes Ctrl+Down to aligned native scrolling', async () => {
    const scrollActiveEditorAlignedStub = sinon.stub().resolves(true);

    await createScrollAlignedDownCommand(createContext(scrollActiveEditorAlignedStub))();

    assert.strictEqual(scrollActiveEditorAlignedStub.callCount, 1);
    assert.deepStrictEqual(scrollActiveEditorAlignedStub.firstCall.args, [1]);
  });
});

function createContext(scrollActiveEditorAlignedStub: sinon.SinonStub): CommandContext {
  return {
    output: { info: sinon.stub() } as never,
    repositoryService: {} as never,
    revisionPickerService: {} as never,
    uriFactory: {} as never,
    compatibilityService: {} as never,
    sessionBuilderService: {} as never,
    sessionService: {} as never,
    compareSessionController: {
      scrollActiveEditorAligned: scrollActiveEditorAlignedStub
    } as never,
    cacheService: {} as never,
    blameDecorationController: {} as never
  } as unknown as CommandContext;
}
