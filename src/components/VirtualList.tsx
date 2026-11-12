import React, { useRef } from 'react';

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
 * Universal high-performance list component optimized for low-end mobile devices & laptops.
 * Uses native browser content-visibility: auto for hardware-accelerated 60fps scrolling
 * without forced synchronous reflows or JavaScript thread lockups.
 */
export function VirtualList<T>({
  items,
  itemHeight,
  renderItem,
  keyExtractor,
  className = '',
  emptyState,
  maxHeight,
}: VirtualListProps<T>): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);

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
      {items.map((item, index) => {
        const key = keyExtractor ? keyExtractor(item, index) : index;
        return (
          <div
            key={key}
            style={{
              contentVisibility: 'auto',
              containIntrinsicSize: `0px ${itemHeight}px`,
            }}
          >
            {renderItem(item, index)}
          </div>
        );
      })}
    </div>
  );
}
