import React, { useState } from 'react';
import { useUsage } from '../hooks/useUsage';

const USD_TO_INR_RATE = 83.50; // Approximate conversion rate

export function UsageTracker(): React.ReactElement {
  const { usageHistory, totalCostUSD } = useUsage();
  const [isExpanded, setIsExpanded] = useState(true);

  const totalCostINR = (totalCostUSD * USD_TO_INR_RATE).toFixed(2);

  const formatCost = (cost: number) => {
    if (cost < 0.0001) return `< ₹0.01`;
    return `₹${(cost * USD_TO_INR_RATE).toFixed(2)}`;
  };

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
      <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <h3 className="font-bold text-sm text-gray-500 tracking-wider uppercase">Credit Usage</h3>
        <span className="font-bold text-sm text-indigo-600">Total: ₹{totalCostINR}</span>
      </div>
      {isExpanded && (
        <div className="mt-2 text-xs text-gray-600 flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
          {usageHistory.length === 0 ? (
            <p className="text-gray-400 text-center py-2">No usage recorded yet.</p>
          ) : (
            usageHistory.map(record => (
              <div key={record.id} className="flex justify-between items-center p-1.5 bg-white rounded-md border border-gray-100">
                <div className="flex flex-col">
                    <span className="font-semibold">{record.task}</span>
                    <span className="text-gray-400">
                        {record.tokens && `${record.tokens} tokens`}
                        {record.images && `${record.images} image${record.images > 1 ? 's' : ''}`}
                        {record.videoSeconds && `${record.videoSeconds}s video`}
                    </span>
                </div>
                <span className="font-mono font-semibold text-indigo-500">{formatCost(record.costUSD)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
