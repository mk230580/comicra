import { useAuth } from '../contexts/AuthContext';
import type { Page, Character } from '../types';

export const PLAN_LIMITS = {
  free: {
    pages: 5,
    characters: 2,
    videoProducer: false,
    name: 'Free'
  },
  pro: {
    pages: 50,
    characters: 10,
    videoProducer: true,
    name: 'Pro'
  },
  premium: {
    pages: Infinity,
    characters: Infinity,
    videoProducer: true,
    name: 'Premium'
  },
};

export const useSubscription = (pages: Page[], characters: Character[]) => {
  const { user } = useAuth();
  const planId = user?.plan || 'free';
  const limits = PLAN_LIMITS[planId];

  const canCreatePage = pages.length < limits.pages;
  const canCreateCharacter = characters.length < limits.characters;
  const canUseVideoProducer = limits.videoProducer;
  const planName = limits.name;

  return {
    plan: planId,
    planName,
    limits,
    canCreatePage,
    canCreateCharacter,
    canUseVideoProducer,
    pageUsage: `${pages.length} / ${limits.pages === Infinity ? '∞' : limits.pages}`,
    characterUsage: `${characters.length} / ${limits.characters === Infinity ? '∞' : limits.characters}`,
  };
};