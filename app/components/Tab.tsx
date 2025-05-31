'use client';

import { useRef, useCallback, useEffect } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';

interface TabProps {
  conversation: {
    id: string;
    name: string;
  };
  index: number;
  isActive: boolean;
  onClick: () => void;
  onClose: () => void;
  onMoveTab: (dragIndex: number, hoverIndex: number) => void;
}

const Tab = ({ conversation, index, isActive, onClick, onClose, onMoveTab }: TabProps) => {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isOver }, dropRef] = useDrop<
    { id: string; index: number }, // item 类型
    void,                          // drop result 类型
    { isOver: boolean }            // collect 返回类型
  >({
    accept: 'TAB',
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
    hover(item, monitor) {
      if (!ref.current) return;

      const dragIndex = item.index;
      const hoverIndex = index;

      if (dragIndex === hoverIndex) return;

      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleX = (hoverBoundingRect.right - hoverBoundingRect.left) / 2;
      const clientOffset = monitor.getClientOffset();

      if (!clientOffset) return;

      const hoverClientX = clientOffset.x - hoverBoundingRect.left;

      const isMovingRight = dragIndex < hoverIndex && hoverClientX > hoverMiddleX;
      const isMovingLeft = dragIndex > hoverIndex && hoverClientX < hoverMiddleX;

      if (isMovingRight || isMovingLeft) {
        onMoveTab(dragIndex, hoverIndex);
        item.index = hoverIndex;
      }
    },
  });

  const [{ isDragging }, dragRef, previewRef] = useDrag({
    type: 'TAB',
    item: { conversation, index },  // 传递整个 conversation 对象
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });  

  useEffect(() => {
    previewRef(getEmptyImage(), { captureDraggingState: true });
  }, [previewRef]);

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      dragRef(node);
      dropRef(node);
      ref.current = node;
    },
    [dragRef, dropRef]
  );

  return (
    <div
      ref={setRefs}
      className={`relative flex items-center whitespace-nowrap px-4 py-2 rounded-lg transition-all duration-150 group min-w-[200px] border border-gray-300 dark:border-gray-600
        ${isActive
          ? 'bg-blue-100 dark:bg-blue-900 text-gray-900 dark:text-white'
          : 'bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'}
        ${isDragging ? 'opacity-70 scale-95 cursor-grabbing' : ''}
        ${isOver ? 'ring-2 ring-blue-400' : ''}
      `}
      onClick={onClick}
    >
      <span className="cursor-pointer">{conversation.name}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        title="Close tab"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

export default Tab;
