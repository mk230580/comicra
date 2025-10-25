import React, { useState, useEffect } from 'react';
import type { Plan, User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { apiGetPlans, apiCreateCheckoutSession, apiManageSubscription } from '../services/apiService';
import { XIcon, CheckCircleIcon } from './icons';

interface PricingModalProps {
  onClose: () => void;
}

export function PricingModal({ onClose }: PricingModalProps) {
  const { user, updateUser } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (user?.plan) {
      apiGetPlans(user.plan).then(data => {
        setPlans(data);
        setIsLoading(false);
      });
    }
  }, [user?.plan]);

  const handleSelectPlan = async (planId: 'pro' | 'premium') => {
    if (!user) return;
    setIsProcessing(planId);
    try {
        const { newUser } = await apiCreateCheckoutSession(user.id, planId);
        updateUser(newUser);
        onClose();
    } catch (error) {
        console.error("Failed to upgrade plan", error);
        alert("Failed to upgrade. Please try again.");
    } finally {
        setIsProcessing(null);
    }
  };
  
  const handleManageSubscription = async () => {
    setIsProcessing('manage');
    await apiManageSubscription();
    setIsProcessing(null);
  };

  const PlanCard = ({ plan }: { plan: Plan }) => (
    <div className={`rounded-xl p-6 border-2 ${plan.isCurrent ? 'border-indigo-500' : 'border-gray-200'} ${plan.name === 'Pro' ? 'bg-indigo-50' : ''}`}>
      <h3 className="text-lg font-bold text-gray-800">{plan.name}</h3>
      <p className="text-3xl font-bold mt-2">${plan.price}<span className="text-base font-normal text-gray-500">/{plan.priceFrequency}</span></p>
      <ul className="mt-6 space-y-3 text-sm text-gray-600">
        {plan.features.map((feature, i) => (
          <li key={i} className="flex items-center gap-2">
            <CheckCircleIcon className="w-5 h-5 text-green-500" />
            {feature}
          </li>
        ))}
      </ul>
      <div className="mt-8">
        {plan.isCurrent ? (
           plan.id !== 'free' ? (
                <button onClick={handleManageSubscription} disabled={isProcessing === 'manage'} className="w-full text-center font-semibold bg-gray-200 text-gray-700 py-2.5 rounded-lg text-sm hover:bg-gray-300">
                    {isProcessing === 'manage' ? 'Redirecting...' : 'Manage Subscription'}
                </button>
           ) : (
                <div className="w-full text-center font-semibold bg-indigo-100 text-indigo-700 py-2.5 rounded-lg text-sm">Your Current Plan</div>
           )
        ) : (
            plan.isUpgrade ? (
                 <button onClick={() => handleSelectPlan(plan.id as 'pro' | 'premium')} disabled={!!isProcessing} className="w-full text-center font-semibold bg-indigo-600 text-white py-2.5 rounded-lg text-sm hover:bg-indigo-500">
                    {isProcessing === plan.id ? 'Processing...' : `Upgrade to ${plan.name}`}
                 </button>
            ) : (
                 <button disabled={true} className="w-full text-center font-semibold bg-gray-200 text-gray-500 py-2.5 rounded-lg text-sm cursor-not-allowed">Downgrade in portal</button>
            )
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <div>
                <h2 className="text-xl font-bold text-gray-800">Subscription Plans</h2>
                <p className="text-sm text-gray-500">Choose a plan that fits your creative needs.</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100"><XIcon className="w-5 h-5 text-gray-600" /></button>
        </div>
        <div className="p-6 flex-grow overflow-y-auto">
            {isLoading ? (
                <div className="text-center p-10">Loading plans...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {plans.map(plan => <PlanCard key={plan.id} plan={plan} />)}
                </div>
            )}
        </div>
      </div>
    </div>
  );
}