import { useContext } from 'react';
import { UsageContext } from '../contexts/UsageContext';

export const useUsage = () => {
  const context = useContext(UsageContext);
  if (context === undefined) {
    throw new Error('useUsage must be used within a UsageProvider');
  }
  return context;
};
