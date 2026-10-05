import React, { useRef } from 'react';
import { useVirtualList } from '../hooks/useVirtualList';

export interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  overscan?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor?: (item: T, index: number) => string | number;
  className?: string;
  emptyState?: React.ReactNode;
  maxHeight?: string | number;
}

/**
 * Universal Virtual List / Windowing component.
 * Supports both internal scroll container or parent window scrolling.
 */
export function VirtualList<T>({
  items,
  itemHeight,
  overscan = 4,
  renderItem,
  keyExtractor,
  className = '',
  emptyState,
  maxHeight,
}: VirtualListProps<T>): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);

  const { virtualItems, paddingTop, paddingBottom, isVirtualizing } = useVirtualList<T>({
    items,
    itemHeight,
    overscan,
    containerRef,
    isWindowScroll: !maxHeight,
  });

  if (items.length === 0) {
    return <>{emptyState || null}</>;
  }

  const containerStyle: React.CSSProperties = maxHeight
    ? { maxHeight, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }
    : {};

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      className={`relative w-full ${className}`}
    >
      <div
        style={{
          paddingTop: isVirtualizing ? `${paddingTop}px` : undefined,
          paddingBottom: isVirtualizing ? `${paddingBottom}px` : undefined,
          boxSizing: 'border-box',
        }}
      >
        {virtualItems.map(({ item, index }) => {
          const key = keyExtractor ? keyExtractor(item, index) : index;
          return (
            <div
              key={key}
              style={{
                contentVisibility: isVirtualizing ? 'auto' : undefined,
                containIntrinsicSize: isVirtualizing ? `0px ${itemHeight}px` : undefined,
              }}
            >
              {renderItem(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
