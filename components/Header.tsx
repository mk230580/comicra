import React from 'react';
import { MenuIcon, XIcon, BookOpenIcon, GlobeIcon, VideoIcon, ArrowLeftIcon, LogoutIcon, CrownIcon } from './icons';
import type { User } from '../types';

interface HeaderProps {
    isSidebarOpen: boolean;
    onToggleSidebar: () => void;
    onShowMangaViewer: () => void;
    onShowWorldview: () => void;
    onShowPricing: () => void;
    onVideoProducerClick: () => void;
    currentView: 'manga-editor' | 'video-producer';
    onSetView: (view: 'manga-editor' | 'video-producer') => void;
    user: User | null;
    onLogout: () => void;
    planName: string;
}

export function Header({ isSidebarOpen, onToggleSidebar, onShowMangaViewer, onShowWorldview, onShowPricing, onVideoProducerClick, currentView, onSetView, user, onLogout, planName }: HeaderProps): React.ReactElement {
  
  const planColor = user?.plan === 'pro' ? 'bg-indigo-100 text-indigo-800' : user?.plan === 'premium' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800';

  return (
    <header className="bg-white border-b border-gray-200 w-full z-20 relative">
      <div className="container mx-auto px-4 lg:px-6 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
            {currentView === 'video-producer' ? (
                <button onClick={() => onSetView('manga-editor')} className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-indigo-600 p-2 rounded-md hover:bg-gray-100" title="Back to Editor">
                    <ArrowLeftIcon className="w-5 h-5" />
                    <span className="hidden md:inline">Back to Editor</span>
                </button>
            ) : (
                <button onClick={onToggleSidebar} className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {isSidebarOpen ? <XIcon className="w-6 h-6 text-gray-700" /> : <MenuIcon className="w-6 h-6 text-gray-700" />}
                </button>
            )}

            <img src="/logo.png" alt="Comicra Logo" className="w-10 h-10" />
            <div>
              <h1 className="text-xl font-bold text-gray-800 tracking-tight">
                  {currentView === 'video-producer' ? 'Comicra Video Producer' : 'Comicra'}
              </h1>
              <p className="text-xs text-gray-500 -mt-1">AI + Imagination</p>
            </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
            {user && (
                 <div className="hidden sm:flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-sm font-semibold text-gray-800">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                     <button onClick={onShowPricing} className={`text-xs font-bold px-2 py-1 rounded-full ${planColor} hover:opacity-80 transition-opacity`}>
                        {planName} Plan
                    </button>
                 </div>
            )}

            {currentView === 'manga-editor' && (
                <>
                    <button onClick={onShowPricing} className="p-2 rounded-md hover:bg-gray-100 sm:hidden" title="Subscription">
                        <CrownIcon className="h-5 w-5 text-yellow-600" />
                    </button>
                    <div className="relative group">
                        <button onClick={onVideoProducerClick} className="p-2 rounded-md hover:bg-gray-100" title="Comicra Video Producer">
                            <VideoIcon className="h-5 w-5 text-gray-600" />
                        </button>
                        {user?.plan === 'free' && (
                             <div className="absolute -top-1 -right-1 bg-yellow-400 text-yellow-900 text-[8px] font-bold px-1 rounded-full pointer-events-none">
                                PRO
                            </div>
                        )}
                    </div>
                     <button onClick={onShowMangaViewer} className="p-2 rounded-md hover:bg-gray-100" title="View Collection">
                        <BookOpenIcon className="h-5 w-5 text-gray-600" />
                    </button>
                    <button onClick={onShowWorldview} className="p-2 rounded-md hover:bg-gray-100" title="Worldview Settings">
                        <GlobeIcon className="h-5 w-5 text-gray-600" />
                    </button>
                </>
            )}
             <button onClick={onLogout} className="p-2 rounded-md hover:bg-red-100" title="Logout">
                <LogoutIcon className="h-5 w-5 text-red-600" />
            </button>
        </div>
      </div>
    </header>
  );
}