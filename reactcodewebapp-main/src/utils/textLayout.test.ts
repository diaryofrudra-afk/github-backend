import { describe, it, expect } from 'vitest';
import { prepare, layout } from '../lib/pretext/layout';

describe('Pretext Integration Accuracy', () => {
  it('measures text width consistently for Jakarta Sans (Primary Hub Font)', () => {
    const text = 'Suprwise Cloud Platform';
    const font = '700 15px "Plus Jakarta Sans"';
    
    // Prepare measurement
    const prepared = prepare(text, font);
    expect(prepared).not.toBeNull();
    
    // Test layout at different widths
    const layout1 = layout(prepared, 500, 24); // wide
    const layout2 = layout(prepared, 100, 24); // narrow
    
    expect(layout1.lineCount).toBe(1);
    expect(layout2.lineCount).toBeGreaterThan(1);
  });

  it('measures text width consistently for Inter (Body Font)', () => {
    const text = 'Fleet management tracking systems for modern operations.';
    const font = '400 12px Inter';
    
    const prepared = prepare(text, font);
    const result = layout(prepared, 200, 16);
    
    expect(result.lineCount).toBeGreaterThan(1);
    expect(result.height).toBe(result.lineCount * 16);
  });
});
