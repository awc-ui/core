// Manager entry: AWC UI branding + the custom Theme panel (SB10 + web-components-vite).
import { addons } from 'storybook/manager-api';
import { awcUiTheme } from './theme.ts';
import './addons/theme-panel/register.tsx';
// Hides the Vitest addon's own Coverage row, which measures the test harness
// rather than the library and cannot be repointed. See the addon file.
import './addons/library-coverage/register.tsx';

addons.setConfig({
  theme: awcUiTheme,
  sidebar: {
    showRoots: true,
  },
});
