import { useState, useEffect, useMemo, useRef } from 'react';

export interface UseVirtualListOptions<T> {
  items: T[];
  itemHeight: number; // Estimated height of each item in pixels
  overscan?: number; // Buffer count of items to render above/below viewport
  containerRef?: React.RefObject<HTMLElement | null>; // Ref to list element or scroll container
  isWindowScroll?: boolean; // Whether scrolling is driven by window or internal container
}

export interface VirtualItem<T> {
  item: T;
  index: number;
}

export interface UseVirtualListReturn<T> {
  virtualItems: VirtualItem<T>[];
  totalHeight: number;
  paddingTop: number;
  paddingBottom: number;
  startIndex: number;
  endIndex: number;
  isVirtualizing: boolean;
}

/**
 * High-performance virtual list / windowing hook optimized for low-end mobile devices.
 * Renders only visible items + overscan buffer, keeping DOM node count under 15-20.
 * Eliminates memory exhaustion and layout thrashing when displaying hundreds of reports.
 */
export function useVirtualList<T>({
  items,
  itemHeight,
  overscan = 4,
  containerRef,
  isWindowScroll = true,
}: UseVirtualListOptions<T>): UseVirtualListReturn<T> {
  const [scrollOffset, setScrollOffset] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 800
  );

  const rafIdRef = useRef<number | null>(null);

  // Measure viewport height & handle resize
  useEffect(() => {
    const updateViewport = () => {
      if (!isWindowScroll && containerRef?.current) {
        setViewportHeight(containerRef.current.clientHeight || 500);
      } else if (typeof window !== 'undefined') {
        setViewportHeight(window.innerHeight || 800);
      }
    };

    updateViewport();

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateViewport, { passive: true });
    }

    let resizeObserver: ResizeObserver | null = null;
    if (!isWindowScroll && containerRef?.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateViewport);
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', updateViewport);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [containerRef, isWindowScroll]);

  // Listen to scroll events with requestAnimationFrame throttling for smooth 60fps on low-spec phones
  useEffect(() => {
    const handleScroll = () => {
      if (rafIdRef.current !== null) return;

      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        if (!isWindowScroll && containerRef?.current) {
          setScrollOffset(containerRef.current.scrollTop);
        } else if (containerRef?.current) {
          const rect = containerRef.current.getBoundingClientRect();
          // Distance from top of list to top of viewport
          const offset = Math.max(0, -rect.top);
          setScrollOffset(offset);
        } else if (typeof window !== 'undefined') {
          setScrollOffset(window.scrollY || document.documentElement.scrollTop || 0);
        }
      });
    };

    if (!isWindowScroll && containerRef?.current) {
      const el = containerRef.current;
      el.addEventListener('scroll', handleScroll, { passive: true });
      return () => {
        el.removeEventListener('scroll', handleScroll);
        if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      };
    } else if (typeof window !== 'undefined') {
      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => {
        window.removeEventListener('scroll', handleScroll);
        if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      };
    }
  }, [containerRef, isWindowScroll]);

  // Virtual calculations
  const totalCount = items.length;
  const totalHeight = totalCount * itemHeight;

  // Only activate virtualization if there are enough items to warrant it (>= 5 items)
  const isVirtualizing = totalCount >= 5;

  const { startIndex, endIndex, paddingTop, paddingBottom, virtualItems } = useMemo(() => {
    if (!isVirtualizing) {
      return {
        startIndex: 0,
        endIndex: totalCount,
        paddingTop: 0,
        paddingBottom: 0,
        virtualItems: items.map((item, index) => ({ item, index })),
      };
    }

    const rawStart = Math.floor(scrollOffset / itemHeight);
    const start = Math.max(0, rawStart - overscan);
    const visibleCount = Math.ceil(viewportHeight / itemHeight);
    const end = Math.min(totalCount, rawStart + visibleCount + overscan);

    const topPad = start * itemHeight;
    const bottomPad = Math.max(0, (totalCount - end) * itemHeight);

    const slice: VirtualItem<T>[] = [];
    for (let i = start; i < end; i++) {
      if (items[i] !== undefined) {
        slice.push({ item: items[i], index: i });
      }
    }

    return {
      startIndex: start,
      endIndex: end,
      paddingTop: topPad,
      paddingBottom: bottomPad,
      virtualItems: slice,
    };
  }, [items, totalCount, itemHeight, overscan, scrollOffset, viewportHeight, isVirtualizing]);

  return {
    virtualItems,
    totalHeight,
    paddingTop,
    paddingBottom,
    startIndex,
    endIndex,
    isVirtualizing,
  };
}
