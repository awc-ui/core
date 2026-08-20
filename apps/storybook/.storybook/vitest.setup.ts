import { beforeAll } from 'vitest';
import { setProjectAnnotations } from '@storybook/web-components-vite';
import * as previewAnnotations from './preview';

/**
 * Applies the project's own preview config (decorators, globals, the a11y
 * gate) to every story under test. Without this, stories run WITHOUT the
 * decorators they are authored against and fail for reasons that have nothing
 * to do with the component.
 */
const project = setProjectAnnotations([previewAnnotations]);

beforeAll(project.beforeAll);
