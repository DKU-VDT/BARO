import React from 'react';
import { motion } from 'motion/react';
import { usePosture } from '../context/PostureContext';
import { Leaf, Droplets, Sprout, Sparkles } from 'lucide-react';

export const VirtualPlant: React.FC = () => {
  const { plantExp } = usePosture();

  const maxExp = 1000;
  const level = Math.floor(plantExp / 200) + 1;
  const expInLevel = plantExp % 200;
  const progressPercent = (expInLevel / 200) * 100;

  // Render different plant states based on level
  const renderPlant = () => {
    switch (level) {
      case 1:
        return (
          <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 4 }}>
            <Sprout className="w-24 h-24 text-emerald-400 drop-shadow-md" />
          </motion.div>
        );
      case 2:
        return (
          <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 3.5 }}>
            <Leaf className="w-28 h-28 text-emerald-500 drop-shadow-lg" />
          </motion.div>
        );
      case 3:
      case 4:
      case 5:
      default:
        return (
          <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 3 }}>
            <div className="relative">
              <Leaf className="w-32 h-32 text-emerald-600 drop-shadow-xl" />
              <motion.div
                animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 5 }}
                className="absolute -top-4 -right-4"
              >
                <Sparkles className="w-8 h-8 text-amber-400" />
              </motion.div>
            </div>
          </motion.div>
        );
    }
  };

  return (
    <div className="bg-white rounded-3xl p-5 lg:p-6 shadow-sm border border-slate-100 flex flex-col items-center justify-between h-full relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-emerald-50/50 to-transparent pointer-events-none" />
      
      <div className="w-full flex justify-between items-start mb-4 z-10">
        <div>
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Droplets className="w-5 h-5 text-blue-400" />
            반려식물 '바른이'
          </h3>
          <p className="text-xs text-slate-500 mt-1">바른 자세로 마일리지를 모아주세요!</p>
        </div>
        <div className="bg-emerald-100 text-emerald-700 font-bold px-3 py-1 rounded-full text-sm">
          Lv.{level}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center my-2 relative z-10">
        {/* Pot */}
        <div className="absolute bottom-0 w-32 h-16 bg-amber-700 rounded-b-3xl rounded-t-lg shadow-inner z-0">
          <div className="w-full h-4 bg-amber-800 rounded-t-lg shadow-sm" />
        </div>
        
        {/* Plant Base */}
        <div className="relative z-10 pb-12">
          {renderPlant()}
        </div>
      </div>

      <div className="w-full mt-2 z-10">
        <div className="flex justify-between text-xs font-semibold text-slate-600 mb-2">
          <span>경험치</span>
          <span>{expInLevel} / 200 XP</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
          <motion.div
            className="bg-emerald-500 h-full rounded-full relative"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ type: 'spring', bounce: 0, duration: 1 }}
          >
            <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]" style={{
              backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
              backgroundSize: '200% 100%'
            }} />
          </motion.div>
        </div>
      </div>
    </div>
  );
};
