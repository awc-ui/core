import { beforeAll, afterEach } from 'vitest';
import { setProjectAnnotations } from '@storybook/web-components-vite';
import * as a11yAnnotations from '@storybook/addon-a11y/preview';
import * as previewAnnotations from './preview';

/**
 * Manual project annotations disable the Vitest addon's automatic provisioning,
 * so include the configured axe hook explicitly. afterEach hooks run in reverse
 * composition order: the local Stencil hydration gate completes before axe.
 * Keep the addon's existing audit mode and the project's rule options intact;
 * axe reports (including warnings) are separate from story/play outcomes.
 */
const project = setProjectAnnotations([a11yAnnotations, previewAnnotations]);

beforeAll(project.beforeAll);

// The installed Storybook runner copies reports only after story.run resolves.
// Retain reports emitted before a play/audit failure as well, without inferring
// an audit result from the story's pass/fail status or creating missing reports.
afterEach(context => {
  const story = (context as typeof context & {
    story?: { reporting?: { reports?: unknown[] } };
  }).story;
  if (Array.isArray(story?.reporting?.reports)) context.task.meta.reports = story.reporting.reports;
});
