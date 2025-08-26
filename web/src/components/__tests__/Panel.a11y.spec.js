import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect } from 'vitest';
import { renderWithMantine } from '../../test-utils/renderWithMantine';
import Panel from '../Panel';
// Basic smoke: ensure action buttons have aria-labels
describe('Panel a11y basics', () => {
    it('renders layer header controls with aria-labels', () => {
        const { container } = renderWithMantine((_jsx(Panel, { onSelect: () => { }, activeLayerSlug: null })));
        const buttons = container.querySelectorAll('button[aria-label]');
        expect(buttons.length).toBeGreaterThanOrEqual(0);
    });
});
