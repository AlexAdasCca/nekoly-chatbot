'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import rehypeRaw from 'rehype-raw';
import type { EmoticonResult } from '@/app/api/chat/route';
import { unstable_batchedUpdates } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import SettingsPanel from './SettingsPanel';
import Tabs from './Tabs';
import ConfirmDialog from './ConfirmDialog';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface Conversation {
  id: string;
  name: string;
  messages: Message[];
  apiKey?: string;
  createdAt: number;
  isClosed?: boolean;
}

export default function Chat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string>('');
  const [globalApiKey, setGlobalApiKey] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [presets, setPresets] = useState<Array<{name: string, content: string}>>([]);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setGlobalApiKey(localStorage.getItem('globalApiKey') || '');
      setSystemPrompt(localStorage.getItem('systemPrompt') || '');
      
      // Load presets from JSON file
      const loadPresets = async () => {
        try {
        const response = await fetch('/config/prompts.json');
          const data = await response.json();
          setPresets(data.presets);
        } catch (error) {
          console.error('Failed to load prompts:', error);
        }
      };
      loadPresets();
    }
  }, []);
  const apiKey = globalApiKey; // Use global API key for all conversations
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversations, setSelectedConversations] = useState<string[]>([]);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const createNewConversation = useCallback((): Conversation => {
    return {
      id: Date.now().toString(),
      name: `Conversation ${conversations.length}`,
      messages: [],
      apiKey: '',
      createdAt: Date.now(),
      isClosed: false
    };
  }, [conversations.length]);

  // Initialize conversations from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedConversations = localStorage.getItem('chatConversations');
      if (savedConversations) {
        const parsed = JSON.parse(savedConversations);
        setConversations(parsed);
        if (parsed.length > 0) {
          const activeConversation = parsed.find((c: Conversation) => !c.isClosed) || parsed[0];
          setCurrentConversationId(activeConversation.id);
          setMessages(activeConversation.messages);
        }
      } else {
        const newConversation = createNewConversation();
        setConversations([newConversation]);
        setCurrentConversationId(newConversation.id);
      }
    }
  }, [createNewConversation]);

  // Save conversations to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined' && conversations.length > 0) {
      localStorage.setItem('chatConversations', JSON.stringify(conversations));
    }
  }, [conversations]);

  // Update messages when conversation changes
  useEffect(() => {
    const conversation = conversations.find(c => c.id === currentConversationId);
    if (conversation) {
      setMessages(conversation.messages);
    }
  }, [currentConversationId, conversations]);

  const [hiddenTabs, setHiddenTabs] = useState<string[]>([]);

  const closeTab = (id: string) => {
    setHiddenTabs(prev => [...prev, id]);
    if (currentConversationId === id) {
      const nextConversation = conversations.find(c => 
        !hiddenTabs.includes(c.id) && c.id !== id
      );
      if (nextConversation) {
        setCurrentConversationId(nextConversation.id);
      } else {
        setCurrentConversationId('');
        setMessages([]);
      }
    }
  };

  const handleNewConversation = useCallback(() => {
    const newConversation = createNewConversation();
    
    // Batch state updates to prevent unnecessary re-renders
    unstable_batchedUpdates(() => {
      setConversations(prev => {
        const updated = [newConversation, ...prev];
        // Update localStorage immediately
        if (typeof window !== 'undefined') {
          localStorage.setItem('chatConversations', JSON.stringify(updated));
        }
        return updated;
      });
      setHiddenTabs(prev => prev.filter(id => id !== newConversation.id));
      setSelectedConversations([]);
      setMessages([]);
      setCurrentConversationId(newConversation.id);
    });
  }, [createNewConversation]);

  const toggleConversationSelection = (id: string) => {
    setSelectedConversations(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id) 
        : [...prev, id]
    );
  };

  const deleteConversations = (ids: string[]) => {
    setConversations(prev => {
      const updated = prev.filter(conv => !ids.includes(conv.id));
      if (typeof window !== 'undefined') {
        localStorage.setItem('chatConversations', JSON.stringify(updated));
      }
      return updated;
    });
    
    if (ids.includes(currentConversationId)) {
      const nextConversation = conversations.find(c => !ids.includes(c.id));
      setCurrentConversationId(nextConversation?.id || '');
    }
    setSelectedConversations([]);
    setHiddenTabs(prev => prev.filter(id => !ids.includes(id)));
  };

  const startEditingConversation = (conv: Conversation) => {
    setEditingConversationId(conv.id);
    setEditingName(conv.name);
  };

  const saveConversationName = () => {
    if (editingConversationId) {
      setConversations(prev => 
        prev.map(conv => 
          conv.id === editingConversationId 
            ? { ...conv, name: editingName } 
            : conv
        )
      );
      setEditingConversationId(null);
    }
  };

  const exportConversations = () => {
    const data = JSON.stringify(conversations, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-conversations-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importConversations = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target?.result as string);
          if (Array.isArray(imported)) {
            setConversations(imported);
            if (imported.length > 0) {
              const activeConversation = imported.find((c: Conversation) => !c.isClosed) || imported[0];
              setCurrentConversationId(activeConversation.id);
              setMessages(activeConversation.messages);
            }
          }
        } catch (error) {
          console.error('Error importing conversations:', error);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleConversationChange = (id: string) => {
    setHiddenTabs(prev => prev.filter(tabId => tabId !== id));
    setCurrentConversationId(id);
  };

  const updateCurrentConversation = (updates: Partial<Conversation>) => {
    setConversations(prev => 
      prev.map(conv => 
        conv.id === currentConversationId 
          ? { ...conv, ...updates } 
          : conv
      )
    );
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, createNewConversation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { 
      role: 'user', 
      content: input,
      timestamp: Date.now()
    };
    
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    updateCurrentConversation({ messages: updatedMessages });
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: input,
          history: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          apiKey: apiKey || undefined,
          systemPrompt: systemPrompt || undefined
        })
      });

      const data = await response.json();
      
      // Handle both new and old response formats
      const responseText = data.content?.text || data.response;
      const emoticons = data.content?.emoticons || data.emoticons || [];
      
      // Combine text and emoticons into a single message
      let fullContent = responseText;
      if (emoticons.length > 0) {
        const emoticonHtml = emoticons.map((emoticon: EmoticonResult) => 
          `<div class="emoticon-container">
            <img src="${emoticon.url}" alt="${emoticon.alt}" 
                 class="emoticon-image" />
            ${emoticon.alt ? `<div class="emoticon-alt">${emoticon.alt}</div>` : ''}
          </div>`
        ).join('');
        fullContent += emoticonHtml;
      }

      const assistantMessage: Message = { 
        role: 'assistant', 
        content: fullContent,
        timestamp: Date.now()
      };
      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      updateCurrentConversation({ 
        messages: finalMessages,
        apiKey: apiKey || undefined
      });
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const [showSidebar, setShowSidebar] = useState(true);
  const [editMode, setEditMode] = useState(false);

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <div className={`${showSidebar ? 'w-64' : 'w-0'} transition-all duration-300 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden`}>
      {!showSidebar && (
        <div className="fixed top-4 left-0 z-50 flex">
          <button
            onClick={() => setShowSidebar(true)}
            className="bg-white dark:bg-gray-800 p-2 rounded-r-lg border border-l-0 border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 shadow-md"
            title="Show sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            onClick={handleNewConversation}
            className="ml-1 bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 shadow-md"
            title="New conversation"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}
        <div className="p-4 h-full flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Conversations</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => setEditMode(!editMode)}
                className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                title={editMode ? 'Exit edit mode' : 'Edit conversations'}
              >
                {editMode ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1">
          {conversations.map(conv => (
              <div
                key={conv.id}
                className={`flex items-center p-2 rounded-lg cursor-pointer ${
                  currentConversationId === conv.id 
                    ? 'bg-gray-200 dark:bg-gray-700' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                onClick={() => handleConversationChange(conv.id)}
              >
                {editMode && (
                  <input
                    type="checkbox"
                    checked={selectedConversations.includes(conv.id)}
                    onChange={() => toggleConversationSelection(conv.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mr-2 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                )}
                {editingConversationId === conv.id ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={saveConversationName}
                    onKeyDown={(e) => e.key === 'Enter' && saveConversationName()}
                    className="flex-1 bg-transparent outline-none"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span 
                    className="flex-1 truncate"
                    onDoubleClick={() => startEditingConversation(conv)}
                  >
                    {conv.name}
                  </span>
                )}
                {editMode && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditingConversation(conv);
                    }}
                    className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    title="Rename"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleNewConversation}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              New Chat
            </button>
            {editMode && selectedConversations.length > 0 && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full mt-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Delete Selected
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
        <DndProvider backend={HTML5Backend}>
          <Tabs
            conversations={conversations}
            hiddenTabs={hiddenTabs}
            currentConversationId={currentConversationId}
            onTabChange={handleConversationChange}
            onTabClose={closeTab}
            onTabsReorder={(newOrder) => {
              // Reorder conversations based on new tab order
              setConversations(prev => 
                newOrder.map(id => prev.find(c => c.id === id)!)
                  .concat(prev.filter(c => !newOrder.includes(c.id)))
              );
            }}
          />
        </DndProvider>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 mb-4 px-2 border border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 shadow-sm">
        <div className="p-4 space-y-6">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div className={`flex flex-col max-w-[85%] group ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`rounded-2xl px-4 py-3 shadow-sm transition-all duration-200 ${
                    message.role === 'user'
                      ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                      : 'bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600'
                  }`}
                >
                  <div className={`prose dark:prose-invert max-w-none ${message.role === 'user' ? 'prose-invert' : ''}`}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        img: ({ src, alt }) => {
                          if (!src) return null;
                          const isBase64 = src.startsWith('data:image');
                          const proxiedSrc = isBase64 ? src : `/api/proxy-image?url=${encodeURIComponent(src)}`;
                          return (
                            <span className="block my-4">
                              <span className="block border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-gray-50 dark:bg-gray-800">
                                <img
                                  src={proxiedSrc}
                                  alt={alt || 'Image'}
                                  className="max-w-full h-auto mx-auto block"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                  }}
                                  crossOrigin="anonymous"
                                  referrerPolicy="no-referrer"
                                />
                                {alt && (
                                  <span className="block text-xs text-center text-gray-500 dark:text-gray-400 mt-1">
                                    {alt}
                                  </span>
                                )}
                              </span>
                            </span>
                          );
                        },
                        h1: ({ children }) => <h1 className="text-xl font-bold mb-2">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-lg font-bold mb-2">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-base font-bold mb-2">{children}</h3>,
                        ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                        li: ({ children }) => <li className="mb-1">{children}</li>,
                        code: ({ children }) => (
                          <code className="bg-gray-100 dark:bg-gray-800 rounded px-1 py-0.5 text-sm font-mono">
                            {children}
                          </code>
                        ),
                        pre: ({ children }) => (
                          <pre className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-2 overflow-x-auto">
                            {children}
                          </pre>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic mb-2">
                            {children}
                          </blockquote>
                        ),
                        table: ({ children }) => (
                          <div className="overflow-x-auto mb-2">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                              {children}
                            </table>
                          </div>
                        ),
                        th: ({ children }) => (
                          <th className="px-4 py-2 bg-gray-100 dark:bg-gray-800 font-semibold text-left">
                            {children}
                          </th>
                        ),
                        td: ({ children }) => (
                          <td className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
                            {children}
                          </td>
                        ),
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                </div>
                <span className="text-xs text-gray-400 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  {formatTime(message.timestamp)}
                </span>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-2xl px-4 py-3 shadow-sm border border-gray-100 dark:border-gray-600">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-100"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      {/* Settings Panel */}
      <SettingsPanel
        onPromptChange={(prompt) => {
          setSystemPrompt(prompt);
          localStorage.setItem('systemPrompt', prompt);
        }}
        options={[
          {
            id: 'model',
            icon: (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M11 17a1 1 0 001.447.894l4-2A1 1 0 0017 15V9.236a1 1 0 00-1.447-.894l-4 2a1 1 0 00-.553.894V17zM15.211 6.276a1 1 0 000-1.788l-4.764-2.382a1 1 0 00-.894 0L4.789 4.488a1 1 0 000 1.788l4.764 2.382a1 1 0 00.894 0l4.764-2.382zM4.447 8.342A1 1 0 003 9.236V15a1 1 0 00.553.894l4 2A1 1 0 009 17v-5.764a1 1 0 00-.553-.894l-4-2z" />
              </svg>
            ),
            title: 'Model Settings',
            content: (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Global API Key
                </label>
                <input
                  type="password"
                  value={globalApiKey}
                  onChange={(e) => {
                    const newKey = e.target.value;
                    setGlobalApiKey(newKey);
                    localStorage.setItem('globalApiKey', newKey);
                    
                    // Update all conversations with new API key
                    setConversations(prev => 
                      prev.map(conv => ({
                        ...conv,
                        apiKey: newKey || undefined
                      }))
                    );
                  }}
                  placeholder="Enter your API key (e.g. sk-...)"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 p-2 mb-2 dark:bg-gray-700"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  This key will be automatically saved and used for all conversations
                </p>
                {globalApiKey && !globalApiKey.startsWith('sk-') && (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                    Warning: The API key format looks incorrect. It should start with &quot;sk-&quot;
                  </p>
                )}
              </div>
            )
          },
          {
            id: 'prompt',
            icon: (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            ),
            title: 'System Prompt',
            content: (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Preset Prompts
                </label>
                <select
                  onChange={(e) => {
                    const selectedPreset = e.target.value;
                    if (selectedPreset) {
                      setSystemPrompt(selectedPreset);
                      localStorage.setItem('systemPrompt', selectedPreset);
                    }
                  }}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 p-2 mb-2 dark:bg-gray-700"
                >
                  <option value="">Select a preset...</option>
                  {presets.map((preset) => (
                    <option key={preset.name} value={preset.content}>
                      {preset.name}
                    </option>
                  ))}
                </select>
                
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Custom Prompt
                </label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => {
                    setSystemPrompt(e.target.value);
                    localStorage.setItem('systemPrompt', e.target.value);
                  }}
                  placeholder="Enter custom system prompt..."
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 p-2 h-32 dark:bg-gray-700"
                />
              </div>
            )
          },
          {
            id: 'import-export',
            icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
            ),
            title: 'Data Management',
            content: (
              <div className="space-y-2">
                <button
                  onClick={exportConversations}
                  className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <span>Export Conversations</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                <label className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer">
                  <span>Import Conversations</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm7.121-6.464a1 1 0 011.415 0l3 3a1 1 0 01-1.415 1.414L11 13.414V17a1 1 0 11-2 0v-3.586l-1.121 1.12a1 1 0 01-1.415-1.413l3-3z" clipRule="evenodd" />
                  </svg>
                  
                  <input 
                    type="file" 
                    accept=".json"
                    onChange={importConversations}
                    className="hidden"
                  />
                </label>
              </div>
            )
          }
        ]}
      />

      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 transition-all duration-200"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
        >
          Send
        </button>
      </form>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Conversations"
        message="Are you sure you want to delete the selected conversations? This action is not reversible."
        onConfirm={() => {
          deleteConversations(selectedConversations);
          setShowDeleteConfirm(false);
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
    </div>
  );
}
