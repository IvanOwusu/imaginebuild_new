import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Coins, TrendingDown, Clock, Activity, Zap } from 'lucide-react';

interface CostProps {
  data: {
    estimatedTotal: number;
    breakdown: { item: string; cost: number }[];
  };
}

const COLORS = ['#4f46e5', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff'];

const CostAnalysis: React.FC<CostProps> = ({ data }) => {
  const breakdown = data?.breakdown || [];
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 animate-in fade-in duration-500">
      <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-800 flex flex-col transition-colors">
        <div className="flex items-center justify-between mb-6 sm:mb-8">
            <h3 className="text-lg sm:text-xl font-black uppercase tracking-tighter flex items-center gap-3 text-slate-900 dark:text-white">
                <Coins className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
                Budget Nodes
            </h3>
            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
                <Activity className="w-3 h-3 text-emerald-500 animate-pulse" />
                <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Grounded</span>
            </div>
        </div>
        
        <div className="h-48 sm:h-64 flex-1">
          {breakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={breakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="cost"
                  nameKey="item"
                  stroke="none"
                >
                  {breakdown.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold', fontSize: '10px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-[10px] font-bold uppercase italic">
              Compiling budget node...
            </div>
          )}
        </div>
        
        <div className="mt-6 sm:mt-8 space-y-2 sm:space-y-3">
          {breakdown.map((item, idx) => (
            <div key={idx} className="flex justify-between text-[10px] sm:text-xs group border-b border-black/5 dark:border-white/5 pb-2">
              <span className="text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors uppercase font-bold tracking-widest">{item.item}</span>
              <span className="font-black text-slate-900 dark:text-white">${item.cost.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6 lg:space-y-8 flex flex-col justify-center">
        <div className="bg-navy-950 dark:bg-indigo-600 p-8 sm:p-10 rounded-[2.5rem] sm:rounded-[3rem] text-white shadow-2xl relative overflow-hidden group transition-all">
          <div className="absolute top-0 right-0 p-6 sm:p-8 opacity-10 group-hover:scale-110 transition-transform">
             <Zap size={80} />
          </div>
          <p className="text-indigo-100 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.3em]">Project Synthesis Total</p>
          <h2 className="text-5xl sm:text-6xl font-black mt-3 leading-none tracking-tighter">${(data?.estimatedTotal || 0).toLocaleString()}</h2>
          
          <div className="mt-8 flex flex-wrap gap-2 sm:gap-3">
            <span className="bg-white/10 px-3 py-1.5 rounded-xl flex items-center gap-2 text-[8px] font-black uppercase tracking-widest backdrop-blur-md">
              <TrendingDown className="w-2.5 h-2.5" /> Optimized
            </span>
            <span className="bg-white/10 px-3 py-1.5 rounded-xl flex items-center gap-2 text-[8px] font-black uppercase tracking-widest backdrop-blur-md">
              <Clock className="w-2.5 h-2.5" /> Static Node
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 sm:p-10 rounded-[2.5rem] sm:rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl space-y-6 sm:space-y-8 transition-colors">
          <div className="flex items-center gap-3">
              <div className="w-1.5 h-8 bg-indigo-600 rounded-full"></div>
              <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-tighter text-xl sm:text-2xl">Forge Logic</h4>
          </div>
          <ul className="space-y-4 sm:space-y-6">
            <li className="flex gap-3 sm:gap-4 group">
              <span className="w-1.5 h-1.5 mt-2 rounded-full bg-emerald-500 flex-shrink-0 group-hover:scale-125 transition-transform" />
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-bold leading-relaxed">
                 Regional material availability analyzed. Synthesis suggesting sustainable timber integration.
              </p>
            </li>
            <li className="flex gap-3 sm:gap-4 group">
              <span className="w-1.5 h-1.5 mt-2 rounded-full bg-indigo-500 flex-shrink-0 group-hover:scale-125 transition-transform" />
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-bold leading-relaxed">
                 Climate node detection active. Optimization suggests passive cooling via aperture adjustment.
              </p>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CostAnalysis;