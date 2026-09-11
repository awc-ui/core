import { InlineValidationPresenter, checkValidityOf, reportValidityOf } from './form';

describe('inline validation presentation', () => {
  function field() {
    const host = document.createElement('div');
    let valid = false;
    let message = 'A value is required.';
    const display = jest.fn();
    const focus = jest.fn();
    const presenter = new InlineValidationPresenter({
      host: () => host,
      validity: () => ({ valid, validationMessage: message }),
      message: display,
      focus,
    });
    host.addEventListener('invalid', (event) => presenter.handleInvalid(event));
    const invalid = () => {
      const event = new Event('invalid', { cancelable: true });
      host.dispatchEvent(event);
      return event;
    };
    return { host, presenter, display, focus, invalid, update: (next: boolean, text = '') => { valid = next; message = text; } };
  }

  it('cancels browser UI while preserving validity and reveals the existing message', () => {
    const f = field();
    expect(f.display).not.toHaveBeenCalled();
    const event = f.invalid();
    expect(event.defaultPrevented).toBe(true);
    expect(f.display).toHaveBeenLastCalledWith('A value is required.');
    f.presenter.refresh();
    expect(f.display).toHaveBeenCalledTimes(1);
  });

  it('updates and clears only the generated message after correction and reset', () => {
    const f = field();
    f.invalid();
    f.update(false, 'Already taken.');
    f.presenter.refresh();
    expect(f.display).toHaveBeenLastCalledWith('Already taken.');
    f.update(true);
    f.presenter.refresh();
    expect(f.display).toHaveBeenLastCalledWith('');
    f.presenter.reset();
    f.display.mockClear();
    f.update(false, 'Required again.');
    f.presenter.refresh();
    expect(f.display).not.toHaveBeenCalled();
    f.invalid();
    expect(f.display).toHaveBeenLastCalledWith('Required again.');
  });

  it('keeps checkValidity silent and still returns false', () => {
    const f = field();
    const internals = { checkValidity: () => { f.invalid(); return false; } } as ElementInternals;
    expect(checkValidityOf(internals)).toBe(false);
    expect(f.display).not.toHaveBeenCalled();
    expect(f.focus).not.toHaveBeenCalled();
    f.invalid();
    expect(f.display).toHaveBeenCalledTimes(1);
  });

  it('shows a report without calling validity APIs recursively', () => {
    const f = field();
    const reportValidity = jest.fn(() => { f.invalid(); return false; });
    expect(reportValidityOf({ reportValidity } as unknown as ElementInternals)).toBe(false);
    expect(reportValidity).toHaveBeenCalledTimes(1);
    expect(f.display).toHaveBeenLastCalledWith('A value is required.');
  });
});
