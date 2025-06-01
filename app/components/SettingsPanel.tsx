'use client';

import { useState, useRef, useEffect } from 'react';
import React from 'react';

interface SettingsOption {
  id: string;
  icon: React.ReactNode;
  title: string;
  content: React.ReactNode;
}

interface SettingsPanelProps {
  options: SettingsOption[];
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  onPromptChange?: (prompt: string) => void;
}

export default function SettingsPanel({ options, position = 'bottom-right', onPromptChange }: SettingsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeOption, setActiveOption] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6',
  };

  const toggleSettings = () => {
    if (isAnimating) return;
    
    setIsAnimating(true);
    setIsOpen((prev) => {
      const newState = !prev;
      if (!newState) setActiveOption(null);
      return newState;
    });
    
    // 动画结束后重置动画状态
    setTimeout(() => setIsAnimating(false), 300);
  };

  const handleOptionClick = (id: string) => {
    setActiveOption((prev) => (prev === id ? null : id));
  };

  // 处理点击外部关闭面板
  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;

      // 如果点击的是主按钮，不关闭面板
      if (buttonRef.current && buttonRef.current.contains(target)) {
        return;
      }

      // 如果点击的是面板内部，不关闭面板
      if (panelRef.current && panelRef.current.contains(target)) {
        return;
      }

      // 否则关闭面板
      setIsOpen(false);
      setActiveOption(null);
    };

    if (isOpen) {
      document.addEventListener('click', handleDocumentClick);
    }

    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [isOpen]);

  // 加载预设提示词
  interface Preset {
    name: string;
    content: string[];
  }

  const [presets, setPresets] = useState<Preset[]>([]);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  useEffect(() => {
    const loadPresets = async () => {
      try {
        const response = await fetch('/config/prompts.json');
        const data = await response.json();
        setPresets(data.presets.map((preset: any) => ({
          ...preset,
          content: Array.isArray(preset.content) ? preset.content : [String(preset.content)]
        })));
      } catch (error) {
        console.error('Failed to load prompts:', error);
      }
    };
    loadPresets();
  }, []);

  const handlePromptChange = (prompt: string | string[]) => {
    const promptText = Array.isArray(prompt) ? prompt.join('\n') : prompt;
    setCustomPrompt(promptText);
    onPromptChange?.(promptText);
  };

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const presetName = e.target.value;
    setSelectedPreset(presetName);
    const selected = presets.find(p => p.name === presetName);
    if (selected) {
      handlePromptChange(selected.content);
    }
  };

  const handleCustomPromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setCustomPrompt(value);
    setSelectedPreset('');
    onPromptChange?.(value);
  };

  return (
    <div
      className={`fixed ${positionClasses[position]} z-50`}
      ref={panelRef}
    >
      {/* 覆盖层 - 仅在面板打开时显示 */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-grey bg-opacity-30 z-40"
          onClick={() => {
            setIsOpen(false);
            setActiveOption(null);
          }}
        />
      )}

      {/* Main Settings Button */}
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleSettings();
        }}
        className={`w-12 h-12 rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow-lg flex items-center justify-center transition-all duration-300 z-50 relative ${
          isOpen ? 'rotate-45 bg-red-500' : ''
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 transition-transform duration-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>

      {/* Expanded Panel */}
      <div className={`relative transition-all duration-300 z-40 ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
        {/* Options Circle */}
        <div className={`absolute -top-40 -left-40 w-80 h-80 transition-all duration-500 ${isOpen ? 'scale-100' : 'scale-0'}`}>
          {options.map((option, index) => {
            const angle = (index * (1.5 * Math.PI)) / options.length;
            const x = 80 + 70 * Math.cos(angle);
            const y = 80 + 70 * Math.sin(angle);

            return (
              <button
                key={option.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleOptionClick(option.id);
                }}
                className={`absolute w-12 h-12 rounded-full bg-white dark:bg-gray-700 shadow-md flex items-center justify-center transition-all duration-300 hover:scale-110 ${
                  activeOption === option.id ? 'ring-2 ring-blue-500 scale-110' : ''
                }`}
                style={{
                  left: `${x}px`,
                  top: `${y}px`,
                  transform: 'translate(-50%, -50%)',
                  transitionDelay: isOpen ? `${index * 50}ms` : '0ms',
                }}
                title={option.title}
              >
                {option.icon}
              </button>
            );
          })}
        </div>

        {/* Settings Card */}
        <div
          className={`absolute bottom-20 right-0 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50 transition-all duration-300 transform ${
            activeOption ? 'opacity-100 translate-y-0' : 'opacity-0 pointer-events-none translate-y-4'
          }`}
        >
          {activeOption && (
            <div className="p-4">
              <h3 className="text-lg font-medium mb-4">
                {options.find((o) => o.id === activeOption)?.title}
              </h3>
              <div className="space-y-4">
                {activeOption === 'prompt' && (
                  <>
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-1">
                        Select Preset Prompt
                      </label>
                      <select
                        value={selectedPreset}
                        onChange={handlePresetChange}
                        className="w-full p-2 border rounded bg-gray-800 text-white border-gray-700 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">-- Select Prompt --</option>
                        {presets.map((preset) => (
                          <option key={preset.name} value={preset.name}>
                            {preset.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Edit Custom Prompt
                      </label>
                      <textarea
                        value={customPrompt}
                        onChange={handleCustomPromptChange}
                        className="w-full p-2 border rounded min-h-[100px]"
                        placeholder="Please press custom prompt..."
                      />
                    </div>
                  </>
                )}
                {activeOption !== 'prompt' && options.find((o) => o.id === activeOption)?.content}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
