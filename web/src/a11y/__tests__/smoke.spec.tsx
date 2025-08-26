import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { renderWithMantine } from '../../test-utils/renderWithMantine';
import App from '../../ui/App';

// matchers already extended in global setup

// Mock heavy Map to avoid canvas/WebGL & network
vi.mock('../../components/Map', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-map" />,
}));

describe('a11y smoke', () => {
  it('App has no critical accessibility violations (critical only)', async () => {
    const { container } = renderWithMantine(<App />);
    const results: any = await axe(container);
    const critical = (results.violations || []).filter((v: any) => v.impact === 'critical');
    if (critical.length) {
      // Log IDs to help triage without failing silently
      console.warn(
        'Critical a11y violations:',
        critical.map((v: any) => v.id),
      );
    }
    expect(critical.length).toBe(0);
  });
});
