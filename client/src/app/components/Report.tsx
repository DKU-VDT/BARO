import React from 'react';
import { motion } from 'motion/react';
import { 
  CheckCircle, 
  Brain, 
  Award, 
  Calendar, 
  Zap, 
  AlertCircle,
  Clock,
  Activity,
  ShieldAlert,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

export const Report: React.FC = () => {
  return (
    <div className="flex-1 p-4 md:p-6 bg-slate-50 flex flex-col h-full overflow-hidden w-full">
      <div className="max-w-7xl mx-auto w-full h-full flex flex-col">
        
        {/* Header - Fixed Height */}
        <div className="shrink-0 flex justify-between items-end mb-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              <Brain className="w-8 h-8 text-indigo-600" />
              AI 주간 자세 리포트
            </h1>
            <p className="text-slate-500 mt-1.5 text-sm md:text-base font-medium">
              일주일간 축적된 자세 데이터를 AI가 심층 분석한 결과입니다.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm font-bold text-indigo-600 bg-indigo-100 px-4 py-2 rounded-xl">
            <Calendar className="w-4 h-4" /> 3월 3주차
          </div>
        </div>

        {/* Main Dashboard Grid */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-4 md:gap-6">
          
          {/* Left Column (Score & Summary) */}
          <div className="w-full md:w-[35%] flex flex-col gap-4 md:gap-6 min-h-0 h-full">
            
            {/* Score Card */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
              className="flex-[0.6] bg-white rounded-3xl p-6 md:p-8 flex flex-col items-center border border-slate-200 shadow-sm relative overflow-hidden"
            >
              <div className="w-full flex justify-between items-center shrink-0">
                <h3 className="font-bold text-slate-800">종합 자세 점수</h3>
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                  <TrendingUp className="w-3 h-3" /> 5점 상승
                </span>
              </div>
              
              <div className="flex-1 w-full flex items-center justify-center min-h-[160px]">
                <div className="relative w-40 h-40 flex items-center justify-center shrink-0">
                  <svg className="absolute inset-0 w-full h-full -rotate-90 transform origin-center">
                    <circle cx="80" cy="80" r="68" className="stroke-slate-100" strokeWidth="12" fill="transparent" />
                    <circle cx="80" cy="80" r="68" className="stroke-indigo-600" strokeWidth="12" fill="transparent" strokeDasharray="427" strokeDashoffset="76" strokeLinecap="round" />
                  </svg>
                  <div className="flex flex-col items-center justify-center z-10">
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-black text-slate-800 tracking-tighter">82</span>
                      <span className="text-lg font-bold text-slate-400 mb-1">점</span>
                    </div>
                    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-0.5">Excellent</span>
                  </div>
                </div>
              </div>

              {/* Body Parts Breakdown */}
              <div className="w-full space-y-5 shrink-0">
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1.5">
                    <span className="text-slate-600 flex items-center gap-1.5"><Activity className="w-3 h-3" />목 (자세 붕괴 방어)</span>
                    <span className="text-indigo-600">85점</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: '85%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1.5">
                    <span className="text-slate-600 flex items-center gap-1.5"><Activity className="w-3 h-3" />어깨 (수평 대칭)</span>
                    <span className="text-amber-600">68점</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: '68%' }}></div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Weekly Summary Card */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
              className="flex-[0.4] bg-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-center relative overflow-hidden"
            >
              <h3 className="text-slate-300 font-bold text-sm mb-5">주간 모니터링 요약</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-slate-200">
                    <div className="p-1.5 bg-indigo-500/20 rounded-lg">
                      <Clock className="w-4 h-4 text-indigo-400" />
                    </div>
                    <span className="text-sm font-medium">총 분석 시간</span>
                  </div>
                  <span className="font-bold text-white tracking-wide">34h 15m</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-slate-200">
                    <div className="p-1.5 bg-emerald-500/20 rounded-lg">
                      <Activity className="w-4 h-4 text-emerald-400" />
                    </div>
                    <span className="text-sm font-medium">바른 자세 비율</span>
                  </div>
                  <span className="font-bold text-white tracking-wide">88%</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-slate-200">
                    <div className="p-1.5 bg-amber-500/20 rounded-lg">
                      <ShieldAlert className="w-4 h-4 text-amber-400" />
                    </div>
                    <span className="text-sm font-medium">경고 발생 횟수</span>
                  </div>
                  <span className="font-bold text-amber-400 tracking-wide">14회</span>
                </div>
              </div>
            </motion.div>

          </div>

          {/* Right Column (Insights & Details) */}
          <div className="w-full md:w-[65%] flex flex-col gap-4 md:gap-6 min-h-0 h-full">
            
            {/* AI Insight Box */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="shrink-0 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden"
            >
              <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <Brain className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-slate-700 text-sm tracking-wide">AI 종합 피드백</h3>
              </div>
              
              <div className="p-6 md:px-8 md:py-6 flex flex-col gap-4">
                <p className="text-[14px] md:text-[15px] text-slate-700 leading-relaxed break-keep font-medium">
                  코어 근육 긴장도가 잘 유지되어 <b className="text-indigo-600">오전 시간대 바른 자세 달성률이 상위 12%</b>에 해당합니다. 하지만 장시간 집중이 요구되는 <b>오후 2~4시 사이</b>에 피로도 누적과 함께 <b className="text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded-md">자세 붕괴 경계 단계</b>가 빈번하게 발생하고 있습니다. 1시간마다 가벼운 스트레칭을 추가해보세요.
                </p>
                <p className="text-[14px] md:text-[15px] text-slate-700 leading-relaxed break-keep font-medium">
                  또한 마우스를 쥔 우측 대비 키보드 타건 시 <b className="text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded-md">좌측 어깨가 아래로 쳐지는 비대칭</b> 현상이 꾸준히 관찰되었습니다. 모니터 상단을 눈높이보다 2~3cm 높이고, 좌측 의자 팔걸이를 한 칸 올려 양쪽 어깨의 수평을 맞추는 것을 권장합니다.
                </p>
              </div>
            </motion.div>

            {/* Pros & Cons Container */}
            <div className="flex-1 flex flex-col sm:flex-row gap-4 md:gap-6 min-h-0">
              
              {/* Good points */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden min-h-0"
              >
                <div className="flex items-center justify-between px-5 py-4 md:px-6 md:py-5 border-b border-slate-100 shrink-0">
                  <h3 className="font-bold text-slate-800">긍정적 변화</h3>
                  <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-3 bg-slate-50/30">
                  <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex-1 flex flex-col justify-center">
                    <p className="text-xs text-slate-500 font-bold mb-1 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> 오전 시간대 (09:00 - 12:00)
                    </p>
                    <p className="font-bold text-slate-800 text-[13px] md:text-sm">바른 자세 유지율 92% 달성</p>
                    <p className="text-[11px] text-slate-500 font-medium mt-1 leading-snug">집중도가 높은 시간대에 흔들림 없는 완벽한 자세 유지</p>
                  </div>
                  <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex-1 flex flex-col justify-center">
                    <p className="text-xs text-slate-500 font-bold mb-1 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5" /> 자세 경고 반응 속도
                    </p>
                    <p className="font-bold text-slate-800 text-[13px] md:text-sm">평균 3초 이내 즉각적 교정</p>
                    <p className="text-[11px] text-slate-500 font-medium mt-1 leading-snug">알림 발생 즉시 자세를 고쳐앉는 습관이 크게 개선됨</p>
                  </div>
                  <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex-1 flex flex-col justify-center">
                    <p className="text-xs text-slate-500 font-bold mb-1 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5" /> 요추 지지력 향상
                    </p>
                    <p className="font-bold text-slate-800 text-[13px] md:text-sm">허리 굽음 횟수 40% 감소</p>
                    <p className="text-[11px] text-slate-500 font-medium mt-1 leading-snug">의자 등받이를 적극 활용하여 요추 부담을 현저히 줄임</p>
                  </div>
                </div>
              </motion.div>

              {/* Bad points */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden min-h-0"
              >
                <div className="flex items-center justify-between px-5 py-4 md:px-6 md:py-5 border-b border-slate-100 shrink-0">
                  <h3 className="font-bold text-slate-800">주의할 점</h3>
                  <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-3 bg-slate-50/30">
                  <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex-1 flex flex-col justify-center">
                    <p className="text-xs text-slate-500 font-bold mb-1 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5" /> 왼쪽 어깨 비대칭 심화
                    </p>
                    <p className="font-bold text-slate-800 text-[13px] md:text-sm">키보드 사용 시 팔걸이 점검 필요</p>
                    <p className="text-[11px] text-slate-500 font-medium mt-1 leading-snug">좌측 팔꿈치 지지대가 낮아 어깨가 지속적으로 아래로 처짐</p>
                  </div>
                  <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex-1 flex flex-col justify-center">
                    <p className="text-xs text-slate-500 font-bold mb-1 flex items-center gap-1.5">
                      <TrendingDown className="w-3.5 h-3.5" /> 자세 붕괴 경고 누적
                    </p>
                    <p className="font-bold text-slate-800 text-[13px] md:text-sm">주간 총 14회 기록 (오후 집중)</p>
                    <p className="text-[11px] text-slate-500 font-medium mt-1 leading-snug">식곤증이 오는 오후 시간에 모니터로 다가가는 습관 발생</p>
                  </div>
                  <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex-1 flex flex-col justify-center">
                    <p className="text-xs text-slate-500 font-bold mb-1 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5" /> 장시간 연속 착석
                    </p>
                    <p className="font-bold text-slate-800 text-[13px] md:text-sm">1시간 이상 무휴식 5회 기록</p>
                    <p className="text-[11px] text-slate-500 font-medium mt-1 leading-snug">근육 경직을 유발하므로 50분마다 가벼운 스트레칭 필요</p>
                  </div>
                </div>
              </motion.div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};