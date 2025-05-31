'use client';

import { useDragLayer } from 'react-dnd';
import type { CSSProperties } from 'react';

const layerStyles: CSSProperties = {
  position: 'fixed',
  pointerEvents: 'none',
  zIndex: 100,
  left: 0,
  top: 0,
};

function getItemStyles(currentOffset: { x: number; y: number } | null): CSSProperties {
  if (!currentOffset) {
    return { display: 'none' };
  }
  const { x, y } = currentOffset;
  return {
    transform: `translate(${x}px, ${y}px)`,
    WebkitTransform: `translate(${x}px, ${y}px)`,
  };
}

export default function CustomDragLayer() {
  const { itemType, isDragging, item, currentOffset } = useDragLayer((monitor) => ({
    item: monitor.getItem(),
    itemType: monitor.getItemType(),
    isDragging: monitor.isDragging(),
    currentOffset: monitor.getSourceClientOffset(),
  }));

  if (!isDragging || itemType !== 'TAB' || !item) {
    return null;
  }

  const name = item.conversation?.name || 'Unknown';

  return (
    <div style={layerStyles}>
      <div style={getItemStyles(currentOffset)}>
        <div
          className="min-w-[200px] px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 shadow-lg opacity-30"
        >
          {name}
        </div>
      </div>
    </div>
  );
}
