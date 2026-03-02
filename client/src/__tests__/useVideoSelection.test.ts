import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVideoSelection } from '../hooks/useVideoSelection';

const ids = ['a', 'b', 'c', 'd', 'e'];

const noMod = { shiftKey: false, metaKey: false, ctrlKey: false };
const shift = { shiftKey: true, metaKey: false, ctrlKey: false };
const meta = { shiftKey: false, metaKey: true, ctrlKey: false };
const ctrl = { shiftKey: false, metaKey: false, ctrlKey: true };

describe('useVideoSelection', () => {
  // ─── Plain click ──────────────────────────────────────────

  it('plain click selects a single video', () => {
    const { result } = renderHook(() => useVideoSelection(ids));
    act(() => result.current.toggle('b', noMod));
    expect(result.current.selectedIds.has('b')).toBe(true);
    expect(result.current.selectedIds.size).toBe(1);
  });

  it('plain click on same video deselects it', () => {
    const { result } = renderHook(() => useVideoSelection(ids));
    act(() => result.current.toggle('b', noMod));
    act(() => result.current.toggle('b', noMod));
    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.hasSelection).toBe(false);
  });

  it('plain click on another video adds to selection (toggle)', () => {
    const { result } = renderHook(() => useVideoSelection(ids));
    act(() => result.current.toggle('a', noMod));
    act(() => result.current.toggle('c', noMod));
    expect(result.current.selectedIds.has('a')).toBe(true);
    expect(result.current.selectedIds.has('c')).toBe(true);
    expect(result.current.selectedIds.size).toBe(2);
  });

  it('plain clicks accumulate multiple selections', () => {
    const { result } = renderHook(() => useVideoSelection(ids));
    act(() => result.current.toggle('a', noMod));
    act(() => result.current.toggle('b', noMod));
    act(() => result.current.toggle('c', noMod));
    expect(result.current.selectedIds.size).toBe(3);
    expect([...result.current.selectedIds]).toEqual(expect.arrayContaining(['a', 'b', 'c']));
  });

  it('plain click removes item when already selected', () => {
    const { result } = renderHook(() => useVideoSelection(ids));
    act(() => result.current.toggle('a', noMod));
    act(() => result.current.toggle('b', noMod));
    act(() => result.current.toggle('a', noMod)); // remove 'a'
    expect(result.current.selectedIds.has('a')).toBe(false);
    expect(result.current.selectedIds.has('b')).toBe(true);
    expect(result.current.selectedIds.size).toBe(1);
  });

  // ─── Meta/Ctrl click ─────────────────────────────────────

  it('meta+click toggles individual items', () => {
    const { result } = renderHook(() => useVideoSelection(ids));
    act(() => result.current.toggle('a', meta));
    act(() => result.current.toggle('c', meta));
    act(() => result.current.toggle('e', meta));
    expect(result.current.selectedIds.size).toBe(3);
    expect([...result.current.selectedIds]).toEqual(expect.arrayContaining(['a', 'c', 'e']));

    // Toggle 'c' off
    act(() => result.current.toggle('c', meta));
    expect(result.current.selectedIds.size).toBe(2);
    expect(result.current.selectedIds.has('c')).toBe(false);
  });

  it('ctrl+click also toggles individual items', () => {
    const { result } = renderHook(() => useVideoSelection(ids));
    act(() => result.current.toggle('b', ctrl));
    act(() => result.current.toggle('d', ctrl));
    expect(result.current.selectedIds.size).toBe(2);
    expect([...result.current.selectedIds]).toEqual(expect.arrayContaining(['b', 'd']));
  });

  // ─── Shift click (range select) ──────────────────────────

  it('shift+click selects a range from last clicked', () => {
    const { result } = renderHook(() => useVideoSelection(ids));
    act(() => result.current.toggle('b', noMod)); // select 'b'
    act(() => result.current.toggle('d', shift)); // shift+click 'd'
    expect(result.current.selectedIds.size).toBe(3);
    expect([...result.current.selectedIds]).toEqual(expect.arrayContaining(['b', 'c', 'd']));
  });

  it('shift+click works backwards', () => {
    const { result } = renderHook(() => useVideoSelection(ids));
    act(() => result.current.toggle('d', noMod)); // select 'd'
    act(() => result.current.toggle('a', shift)); // shift+click 'a'
    expect(result.current.selectedIds.size).toBe(4);
    expect([...result.current.selectedIds]).toEqual(expect.arrayContaining(['a', 'b', 'c', 'd']));
  });

  it('shift+click after meta+click uses last clicked as anchor', () => {
    const { result } = renderHook(() => useVideoSelection(ids));
    act(() => result.current.toggle('a', meta));
    act(() => result.current.toggle('c', meta)); // last clicked = 'c'
    act(() => result.current.toggle('e', shift)); // range c..e
    expect(result.current.selectedIds.size).toBe(4); // a, c, d, e
    expect([...result.current.selectedIds]).toEqual(expect.arrayContaining(['a', 'c', 'd', 'e']));
  });

  // ─── selectAll / clearSelection ───────────────────────────

  it('selectAll selects all ordered IDs', () => {
    const { result } = renderHook(() => useVideoSelection(ids));
    act(() => result.current.selectAll());
    expect(result.current.selectedIds.size).toBe(5);
    expect([...result.current.selectedIds]).toEqual(expect.arrayContaining(ids));
  });

  it('clearSelection empties the set', () => {
    const { result } = renderHook(() => useVideoSelection(ids));
    act(() => result.current.selectAll());
    act(() => result.current.clearSelection());
    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.hasSelection).toBe(false);
  });

  // ─── hasSelection ────────────────────────────────────────

  it('hasSelection is true when items are selected', () => {
    const { result } = renderHook(() => useVideoSelection(ids));
    expect(result.current.hasSelection).toBe(false);
    act(() => result.current.toggle('a', noMod));
    expect(result.current.hasSelection).toBe(true);
  });

  // ─── Escape key clears selection ─────────────────────────

  it('Escape key clears selection', () => {
    const { result } = renderHook(() => useVideoSelection(ids));
    act(() => result.current.toggle('a', noMod));
    expect(result.current.hasSelection).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.hasSelection).toBe(false);
  });

  it('Escape does nothing when nothing is selected', () => {
    const { result } = renderHook(() => useVideoSelection(ids));
    // Should not throw
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.selectedIds.size).toBe(0);
  });

  // ─── Edge cases ──────────────────────────────────────────

  it('shift+click without prior click acts as plain select', () => {
    const { result } = renderHook(() => useVideoSelection(ids));
    // No prior click, shift+click should just add the item
    act(() => result.current.toggle('c', shift));
    expect(result.current.selectedIds.has('c')).toBe(true);
  });

  it('handles IDs not in orderedIds gracefully', () => {
    const { result } = renderHook(() => useVideoSelection(ids));
    act(() => result.current.toggle('z', noMod));
    // Should still select it (plain click just clears and adds)
    expect(result.current.selectedIds.has('z')).toBe(true);
  });

  it('updates when orderedIds changes', () => {
    const { result, rerender } = renderHook(
      ({ ids }) => useVideoSelection(ids),
      { initialProps: { ids: ['a', 'b', 'c'] } }
    );
    act(() => result.current.toggle('a', noMod));
    act(() => result.current.toggle('c', shift));
    expect(result.current.selectedIds.size).toBe(3);

    // Re-render with new IDs - selection persists (no automatic clearing)
    rerender({ ids: ['x', 'y', 'z'] });
    expect(result.current.selectedIds.size).toBe(3); // still has old selection
  });
});
