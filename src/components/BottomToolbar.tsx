"use client";

import { useState } from "react";

export type ToolType = "home" | "search" | "image" | "edit" | "text" | "share";

interface Tool {
  id: ToolType;
  label: string;
  icon: React.ReactNode;
}

interface BottomToolbarProps {
  activeTool?: ToolType;
  onToolChange?: (tool: ToolType) => void;
}

const tools: Tool[] = [
  {
    id: "home",
    label: "Home",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    id: "search",
    label: "Search",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    id: "image",
    label: "Image Generator",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: "edit",
    label: "Edit",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    id: "text",
    label: "Text",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: "share",
    label: "Share",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
      </svg>
    ),
  },
];

export default function BottomToolbar({ activeTool = "image", onToolChange }: BottomToolbarProps) {
  const [internalActiveTool, setInternalActiveTool] = useState<ToolType>(activeTool);

  const handleToolClick = (toolId: ToolType) => {
    setInternalActiveTool(toolId);
    onToolChange?.(toolId);
  };

  const currentActiveTool = activeTool || internalActiveTool;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
      <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
        {tools.map((tool) => {
          const isActive = currentActiveTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => handleToolClick(tool.id)}
              className={`relative p-3 rounded-xl transition-all ${
                isActive
                  ? "text-gray-900 dark:text-white"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
              aria-label={tool.label}
              title={tool.label}
            >
              {isActive && (
                <div className="absolute inset-0 bg-red-50 dark:bg-red-900/20 rounded-xl border-2 border-red-500 dark:border-red-400" />
              )}
              <span className="relative z-10">{tool.icon}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
