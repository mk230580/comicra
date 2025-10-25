import React from 'react';
import { XIcon, CrownIcon } from './icons';

interface UpgradeModalProps {
  onClose: () => void;
  onUpgrade: () => void;
}

export function UpgradeModal({ onClose, onUpgrade }: UpgradeModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col text-center p-8">
        <CrownIcon className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-800">Upgrade to Pro</h2>
        <p className="text-gray-600 mt-2">
          You've reached the limit of your current plan. Upgrade to a Pro or Premium plan to unlock more pages, characters, and advanced features like the Video Producer.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <button 
            onClick={onClose} 
            className="bg-white border border-gray-300 text-gray-700 font-semibold py-2 px-6 rounded-lg hover:bg-gray-100 transition-colors text-sm"
          >
            Maybe Later
          </button>
          <button 
            onClick={onUpgrade} 
            className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-500 transition-colors text-sm"
          >
            View Plans
          </button>
        </div>
      </div>
    </div>
  );
}