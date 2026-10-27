// Keep the saved preference separate from the currently resolved color scheme.
// Legacy light/dark values remain explicit choices; missing values follow System.
export function initializeAppearance({
  root = document.documentElement,
  choices = [],
  button = null,
  system = matchMedia('(prefers-color-scheme: dark)'),
  extension = globalThis.chrome?.runtime?.id ? chrome : null,
} = {}) {
  let preference = 'system', revision = 0;
  function apply(value) {
    preference = ['system', 'light', 'dark'].includes(value) ? value : 'system';
    root.dataset.theme = preference === 'system' ? (system.matches ? 'dark' : 'light') : preference;
    for (const choice of choices) choice.checked = choice.value === preference;
    if (button) button.title = `Appearance: ${preference[0].toUpperCase()}${preference.slice(1)}`;
  }
  apply('system');
  system.addEventListener('change', () => {
    if (preference === 'system') apply('system');
  });
  for (const choice of choices) {
    choice.addEventListener('change', () => {
      if (!choice.checked) return;
      revision++;
      apply(choice.value);
      extension?.storage.local.set({theme: preference}).catch(() => {});
    });
  }
  if (!extension) return Promise.resolve();

  extension.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !Object.hasOwn(changes, 'theme')) return;
    revision++;
    apply(changes.theme.newValue);
  });
  const startupRevision = revision;
  return extension.storage.local.get('theme').then(saved => {
    if (revision === startupRevision) apply(saved.theme);
  }).catch(() => {});
}
