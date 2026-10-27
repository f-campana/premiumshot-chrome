import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeAppearance} from '../lib/appearance.js';

class System extends EventTarget {
  constructor(dark) { super(); this.matches = dark; }
  change(dark) { this.matches = dark; this.dispatchEvent(new Event('change')); }
}
class Choices {
  inputs = ['system', 'light', 'dark'].map(value => Object.assign(new EventTarget(), {value, checked: value === 'system'}));
  get value() { return this.inputs.find(input => input.checked)?.value; }
  change(value) {
    for (const input of this.inputs) input.checked = input.value === value;
    this.inputs.find(input => input.checked).dispatchEvent(new Event('change'));
  }
}
function storage(saved) {
  const listeners = [], writes = [];
  const emit = (changes, area = 'local') => listeners.forEach(listener => listener(changes, area));
  return {
    writes, emit,
    api: {storage: {
      onChanged: {addListener: listener => listeners.push(listener)},
      local: {
        get: () => Promise.resolve({theme: saved}),
        set: value => {
          writes.push(value); saved = value.theme;
          emit({theme: {newValue: saved}});
          return Promise.resolve();
        },
      },
    }},
  };
}

test('System tracks live appearance; explicit choices ignore system changes until System is restored', async () => {
  const root = {dataset: {}}, select = new Choices(), system = new System(false);
  await initializeAppearance({root, choices: select.inputs, system, extension: null});
  assert.deepEqual([select.value, root.dataset.theme], ['system', 'light']);
  system.change(true);
  assert.deepEqual([select.value, root.dataset.theme], ['system', 'dark']);
  select.change('light');
  system.change(false); system.change(true);
  assert.equal(root.dataset.theme, 'light');
  select.change('dark'); system.change(false);
  assert.equal(root.dataset.theme, 'dark');
  select.change('system');
  assert.equal(root.dataset.theme, 'light');
});

test('Legacy light/dark choices are retained; absent, invalid or unavailable settings fall back to System', async () => {
  for (const saved of ['light', 'dark', undefined, 'unknown']) {
    const root = {dataset: {}}, select = new Choices(), system = new System(true), store = storage(saved);
    await initializeAppearance({root, choices: select.inputs, system, extension: store.api});
    const expected = ['light', 'dark'].includes(saved) ? saved : 'system';
    assert.equal(select.value, expected);
    assert.equal(root.dataset.theme, expected === 'light' ? 'light' : 'dark');
  }
  const root = {dataset: {}}, store = storage('light');
  store.api.storage.local.get = () => Promise.reject(new Error('Storage unavailable'));
  await initializeAppearance({root, system: new System(true), extension: store.api});
  assert.equal(root.dataset.theme, 'dark');
});

test('Preference is saved and synchronized across editor and popup without echo writes', async () => {
  const store = storage('light'), editor = {dataset: {}}, popup = {dataset: {}}, select = new Choices();
  await Promise.all([
    initializeAppearance({root: editor, choices: select.inputs, system: new System(true), extension: store.api}),
    initializeAppearance({root: popup, system: new System(true), extension: store.api}),
  ]);
  select.change('dark');
  assert.deepEqual(store.writes, [{theme: 'dark'}]);
  assert.equal(editor.dataset.theme, 'dark'); assert.equal(popup.dataset.theme, 'dark');
  store.emit({theme: {newValue: 'light'}}, 'sync');
  store.emit({recipe: {newValue: {look: 'tide'}}});
  assert.equal(select.value, 'dark');
  store.emit({theme: {newValue: 'system'}});
  assert.equal(select.value, 'system'); assert.equal(popup.dataset.theme, 'dark');
  store.emit({theme: {newValue: undefined}});
  assert.equal(select.value, 'system');
  assert.equal(store.writes.length, 1);
});

test('A late startup read cannot overwrite a newer user or cross-tab choice', async () => {
  for (const trigger of ['user', 'other tab']) {
    const store = storage('light'), root = {dataset: {}}, select = new Choices();
    let finishRead;
    store.api.storage.local.get = () => new Promise(resolve => { finishRead = resolve; });
    const ready = initializeAppearance({root, choices: select.inputs, system: new System(false), extension: store.api});
    if (trigger === 'user') select.change('dark');
    else store.emit({theme: {newValue: 'dark'}});
    finishRead({theme: 'light'});
    await ready;
    assert.deepEqual([select.value, root.dataset.theme], ['dark', 'dark']);
  }
});
