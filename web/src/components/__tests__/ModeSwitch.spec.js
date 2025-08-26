import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModeSwitch } from '../../map/ModeSwitch';
import { renderWithMantine } from '../../test-utils/renderWithMantine';
describe('ModeSwitch', () => {
    it('renders nothing when 3d not allowed', () => {
        const { container } = renderWithMantine(_jsx(ModeSwitch, { mode: "2d", setMode: () => { }, canUse3D: false }));
        // Should not render SegmentedControl (radiogroup)
        expect(container.querySelector('[role="radiogroup"]')).toBeNull();
    });
    it('switches mode when user toggles', async () => {
        let mode = '2d';
        const setMode = (m) => {
            mode = m;
        };
        const user = userEvent.setup();
        renderWithMantine(_jsx(ModeSwitch, { mode: mode, setMode: setMode, canUse3D: true }));
        const radio = screen.getByRole('radio', { name: /3D Globe/i });
        await user.click(radio);
        expect(mode).toBe('3d');
    });
});
