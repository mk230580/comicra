import React, { createContext, useState, useCallback, ReactNode } from 'react';
import type { UsageRecord } from '../types';

interface UsageContextType {
  usageHistory: UsageRecord[];
  addUsageRecord: (record: Omit<UsageRecord, 'id' | 'timestamp'>) => void;
  totalCostUSD: number;
}

export const UsageContext = createContext<UsageContextType | undefined>(undefined);

export const UsageProvider = ({ children }: { children: ReactNode }) => {
  const [usageHistory, setUsageHistory] = useState<UsageRecord[]>([]);
  const [totalCostUSD, setTotalCostUSD] = useState(0);

  const addUsageRecord = useCallback((record: Omit<UsageRecord, 'id' | 'timestamp'>) => {
    const newRecord: UsageRecord = {
      ...record,
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
    };
    setUsageHistory(prev => [newRecord, ...prev]);
    setTotalCostUSD(prev => prev + newRecord.costUSD);
  }, []);

  return (
    <UsageContext.Provider value={{ usageHistory, addUsageRecord, totalCostUSD }}>
      {children}
    </UsageContext.Provider>
  );
};
