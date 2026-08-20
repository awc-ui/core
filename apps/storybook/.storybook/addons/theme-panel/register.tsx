import React from 'react';
import { addons, types } from 'storybook/manager-api';
import { ThemePanel } from './ThemePanel.tsx';
import { ADDON_ID, PANEL_ID } from './constants.ts';

addons.register(ADDON_ID, () => {
  addons.add(PANEL_ID, {
    type: types.PANEL,
    title: 'Theme',
    // Bottom panel is only rendered on canvas (story) view, not Docs pages.
    match: ({ viewMode }) => viewMode === 'story',
    render: ({ active }) => (active ? <ThemePanel /> : null),
  });
});
