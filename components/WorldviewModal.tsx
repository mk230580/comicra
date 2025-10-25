import React, { useState } from 'react';
import { GlobeIcon, XIcon, WandIcon } from './icons';
import type { Character } from '../types';
import { generateWorldview } from '../services/geminiService';
import { useUsage } from '../hooks/useUsage';


interface WorldviewModalProps {
  initialWorldview: string;
  onSave: (worldview: string) => void;
  onClose: () => void;
  onAutoGenerate: (numPages: number) => void;
  isGenerating: boolean;
  characters: Character[];
}

export function WorldviewModal({ initialWorldview, onSave, onClose, onAutoGenerate, isGenerating, characters }: WorldviewModalProps) {
  const [worldview, setWorldview] = useState(initialWorldview);
  const [numPages, setNumPages] = useState(3);
  const [isGeneratingWorldview, setIsGeneratingWorldview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addUsageRecord } = useUsage();

  const handleSave = () => {
    onSave(worldview);
  };
  
  const handleAutoGenerate = () => {
    onAutoGenerate(numPages);
  };
  
  const handleGenerateWorldview = async () => {
    if (characters.length === 0) return;
    setIsGeneratingWorldview(true);
    setError(null);
    try {
        const { data: result, usage } = await generateWorldview(characters);
        addUsageRecord(usage);
        setWorldview(result);
    } catch(e) {
        setError(e instanceof Error ? e.message : "An unknown error occurred");
    } finally {
        setIsGeneratingWorldview(false);
    }
  };

  const canAutoGenerate = characters.length > 0 || worldview.trim() !== '';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <GlobeIcon className="w-6 h-6 text-indigo-600" />
            <div>
              <h3 className="text-lg font-bold text-gray-800">Worldview Settings</h3>
              <p className="text-sm text-gray-500">Enter the background settings, rules, and major events of your manga. The AI uses this to suggest consistent stories.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <XIcon className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        <div className="p-4 flex-grow flex flex-col gap-4">
            <div className="flex justify-end">
                 <button 
                    onClick={handleGenerateWorldview}
                    disabled={characters.length === 0 || isGeneratingWorldview}
                    className="flex items-center gap-2 bg-purple-600 text-white font-bold py-1.5 px-3 rounded-lg hover:bg-purple-500 transition-colors text-xs disabled:bg-gray-400"
                    title={characters.length === 0 ? "At least one character must be registered or a worldview must be entered to start auto-generation." : "Generate with AI"}
                >
                    <WandIcon className="w-4 h-4" />
                    {isGeneratingWorldview ? "Generating..." : "Generate with AI"}
                </button>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <textarea
                value={worldview}
                onChange={(e) => setWorldview(e.target.value)}
                placeholder="e.g., In the year 2042, humanity has colonized Mars. All technology is powered by a mysterious substance called 'Core Crystal'..."
                className="w-full h-full bg-gray-50 border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition resize-none flex-grow"
                aria-label="Worldview"
            />
            <div className="border-t border-gray-200 pt-4">
                <h4 className="text-md font-bold text-gray-800 mb-2">Continuous Auto-Generation</h4>
                <div className="flex items-center gap-4">
                <label htmlFor="num-pages" className="text-sm font-semibold text-gray-600">Number of Pages:</label>
                <input 
                    id="num-pages"
                    type="number"
                    value={numPages}
                    onChange={(e) => setNumPages(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    max="10"
                    className="w-20 bg-gray-50 border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    disabled={!canAutoGenerate || isGenerating}
                />
                <button 
                    onClick={handleAutoGenerate}
                    disabled={!canAutoGenerate || isGenerating}
                    className="flex-grow bg-green-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-green-500 transition-colors text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    Start Generation
                </button>
                </div>
                {!canAutoGenerate && (
                <p className="text-xs text-red-600 mt-2">At least one character must be registered or a worldview must be entered to start auto-generation.</p>
                )}
            </div>
        </div>
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="bg-white border border-gray-300 text-gray-700 font-semibold py-2 px-5 rounded-lg hover:bg-gray-100 transition-colors text-sm">Cancel</button>
          <button onClick={handleSave} className="bg-indigo-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-indigo-500 transition-colors text-sm">Save</button>
        </div>
      </div>
    </div>
  );
}