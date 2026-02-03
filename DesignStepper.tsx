import React from 'react';
import { Check } from 'lucide-react';

interface StepperProps {
  currentStep: number;
  steps: string[];
}

const DesignStepper: React.FC<StepperProps> = ({ currentStep, steps }) => {
  return (
    <div className="w-full py-3 px-4 sm:px-6 bg-white/70 dark:bg-navy-950/70 backdrop-blur-md border-b border-black/5 dark:border-white/5 sticky top-0 z-20 transition-all">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {steps.map((step, index) => (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center group relative">
              <div className={`
                w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 text-xs sm:text-sm
                ${index < currentStep ? 'bg-indigo-600 border-indigo-600 text-white' : 
                  index === currentStep ? 'border-indigo-600 text-indigo-600 ring-4 ring-indigo-50 dark:ring-indigo-900/20' : 
                  'border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-600'}
              `}>
                {index < currentStep ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : <span>{index + 1}</span>}
              </div>
              <span className={`hidden sm:block mt-2 text-[10px] font-black uppercase tracking-widest ${index === currentStep ? 'text-indigo-600' : 'text-slate-500 dark:text-slate-600'}`}>
                {step}
              </span>
              {/* Tooltip-like indicator for mobile */}
              {index === currentStep && (
                <span className="sm:hidden absolute -bottom-4 text-[7px] font-black uppercase tracking-[0.2em] text-indigo-600 whitespace-nowrap">
                  {step}
                </span>
              )}
            </div>
            {index < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 sm:mx-4 transition-all duration-500 ${index < currentStep ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-800'}`} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default DesignStepper;