import { observeElementDefinition } from './element-definition';

describe('observeElementDefinition', () => {
  it('shares the native definition wait and releases cancelled callbacks', async () => {
    let define!: () => void;
    const whenDefined = jest.fn(() => new Promise<void>(resolve => { define = resolve; }));
    const registry = { whenDefined } as unknown as CustomElementRegistry;
    const removed = jest.fn();
    const live = jest.fn();
    const cancel = observeElementDefinition(registry, 'md-fab', removed);
    cancel();
    observeElementDefinition(registry, 'md-fab', live);

    expect(whenDefined).toHaveBeenCalledTimes(1);
    define();
    await Promise.resolve();
    await Promise.resolve();
    expect(removed).not.toHaveBeenCalled();
    expect(live).toHaveBeenCalledTimes(1);
  });
});
