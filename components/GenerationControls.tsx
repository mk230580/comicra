import React from 'react';
import { WandIcon, LightbulbIcon } from './icons';
import type { Character } from '../types';

interface GenerationControlsProps {
  onGenerateImage: () => void;
  isLoading: boolean;
  colorMode: 'color' | 'monochrome';
  setColorMode: (mode: 'color' | 'monochrome') => void;
  isReadyToGenerate: boolean;
  sceneDescription: string;
  onSceneDescriptionChange: (desc: string) => void;
  onSuggestLayout: () => void;
  isSuggestingLayout: boolean;
  onSuggestStory: () => void;
  characters: Character[];
  hasGeneratedResult: boolean;
  onViewResult: () => void;
  generateEmptyBubbles: boolean;
  setGenerateEmptyBubbles: (value: boolean) => void;
  assistantModeState: {
    isActive: boolean;
    totalPages: number;
    currentPageNumber: number;
    statusMessage: string;
  } | null;
  canCreatePage: boolean;
  onLimitReached: () => void;
}

export function GenerationControls({ 
    onGenerateImage,
    isLoading, 
    colorMode, 
    setColorMode, 
    isReadyToGenerate,
    sceneDescription,
    onSceneDescriptionChange,
    onSuggestLayout,
    isSuggestingLayout,
    onSuggestStory,
    characters,
    hasGeneratedResult,
    onViewResult,
    generateEmptyBubbles,
    setGenerateEmptyBubbles,
    assistantModeState,
    canCreatePage,
    onLimitReached
}: GenerationControlsProps): React.ReactElement {
  
  const canSuggestLayout = !!sceneDescription;

  const handleSuggestStory = () => {
    if (!canCreatePage) {
        onLimitReached();
        return;
    }
    onSuggestStory();
  }
  
  const handleSuggestLayout = () => {
     if (!canCreatePage) {
        onLimitReached();
        return;
    }
    onSuggestLayout();
  }

  return (
    <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex-grow flex flex-col">
       <div className="flex justify-between items-center mb-4">
         <h2 className="text-md font-semibold text-gray-700">Generate Your Comicra</h2>
         {hasGeneratedResult && (
            <button onClick={onViewResult} className="text-sm font-semibold text-indigo-600 hover:underline">
                View Result
            </button>
         )}
       </div>
        
        <div className="flex flex-col gap-2 flex-grow">
            <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-gray-600">Scene Script</h3>
                 <button
                    onClick={handleSuggestStory}
                    disabled={!canCreatePage}
                    className="flex items-center gap-2 bg-yellow-400 text-yellow-900 font-bold py-1.5 px-3 rounded-lg hover:bg-yellow-500 transition-colors text-xs disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
                >
                    <LightbulbIcon className="w-4 h-4" />
                    Flesh out Story
                </button>
            </div>
            <textarea
                value={sceneDescription}
                onChange={(e) => onSceneDescriptionChange(e.target.value)}
                placeholder="Write the final script here, based on the AI-generated layout and story, or from your own imagination."
                className="w-full flex-grow bg-gray-50 border border-gray-300 rounded-md p-3 text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition resize-y"
                aria-label="Editable scene script"
            />
        </div>

        <div className="flex flex-col gap-4 mt-4">
            <button
                onClick={handleSuggestLayout}
                disabled={!canSuggestLayout || isSuggestingLayout || !canCreatePage}
                className="w-full bg-purple-600 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-purple-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center text-sm gap-2"
            >
                <WandIcon className="w-5 h-5" />
                {isSuggestingLayout ? 'Suggesting...' : 'Suggest Layout'}
            </button>
            <div className="flex rounded-lg bg-gray-100 p-1 w-full">
            <button
                onClick={() => setColorMode('monochrome')}
                className={`w-1/2 px-3 py-2 text-sm font-semibold rounded-md transition-colors ${colorMode === 'monochrome' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
            >
                Monochrome
            </button>
            <button
                onClick={() => setColorMode('color')}
                className={`w-1/2 px-3 py-2 text-sm font-semibold rounded-md transition-colors ${colorMode === 'color' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
            >
                Color
            </button>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm">
                <input
                    id="empty-bubbles"
                    type="checkbox"
                    checked={generateEmptyBubbles}
                    onChange={(e) => setGenerateEmptyBubbles(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="empty-bubbles" className="font-medium text-gray-700">Generate empty speech bubbles</label>
            </div>
            
            <button
                onClick={onGenerateImage}
                disabled={isLoading || !isReadyToGenerate}
                className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center text-sm"
            >
                {isLoading ? `Generating...` : 'Generate Final Page'}
            </button>
            
            {!isReadyToGenerate && <p className="text-xs text-center text-gray-500 col-span-2">Please write a scene script to generate the page.</p>}
        </div>
    </div>
  );
}