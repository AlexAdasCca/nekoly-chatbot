'use client';

import { useState, useEffect, useCallback } from 'react';
import Tab from './Tab';
import CustomDragLayer from './CustomDragLayer';

interface TabsProps {
  conversations: Array<{
    id: string;
    name: string;
  }>;
  hiddenTabs: string[];
  currentConversationId: string;
  onTabChange: (id: string) => void;
  onTabClose: (id: string) => void;
  onTabsReorder: (newOrder: string[]) => void;
}

export default function Tabs({
  conversations,
  hiddenTabs,
  currentConversationId,
  onTabChange,
  onTabClose,
  onTabsReorder,
}: TabsProps) {
  const [tabOrder, setTabOrder] = useState<string[]>(conversations.map(c => c.id));

  useEffect(() => {
    setTabOrder(prev => {
      const currentIds = conversations.map(c => c.id);
      return currentIds.filter(id => prev.includes(id)).concat(currentIds.filter(id => !prev.includes(id)));
    });
  }, [conversations]);

  const handleMoveTab = useCallback((dragIndex: number, hoverIndex: number) => {
    setTabOrder(prevOrder => {
      if (dragIndex === hoverIndex) return prevOrder;

      const newOrder = [...prevOrder];
      const [moved] = newOrder.splice(dragIndex, 1);
      newOrder.splice(hoverIndex, 0, moved);

      onTabsReorder(newOrder);
      return newOrder;
    });
  }, [onTabsReorder]);

  const visibleTabs = tabOrder
    .map(id => conversations.find(c => c.id === id))
    .filter((c): c is { id: string; name: string } => !!c && !hiddenTabs.includes(c.id));

  return (
    <div className="tabs-container flex items-center space-x-2 pb-2 min-h-[44px] bg-gray-100 dark:bg-gray-900 p-2 rounded-lg shadow-sm w-full z-10 relative">
      <div className="flex-1 flex overflow-x-auto space-x-2">
        {visibleTabs.length === 0 ? (
          <div className="text-gray-500 italic">No open tabs</div>
        ) : (
          visibleTabs.map((conversation, index) => (
            <Tab
              key={conversation.id}
              conversation={conversation}
              index={index}
              isActive={currentConversationId === conversation.id}
              onClick={() => onTabChange(conversation.id)}
              onClose={() => onTabClose(conversation.id)}
              onMoveTab={handleMoveTab}
            />
          ))
        )}
      </div>
      {/* 🌟 挂载拖影 */}
      <CustomDragLayer />
    </div>
  );
}
