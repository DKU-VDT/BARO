import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { Activity, Clock, Award, ShieldAlert, Calendar, Cpu } from 'lucide-react';
import { LiveCamera } from './LiveCamera';
import { CameraSetupWizard } from './CameraSetupWizard';
import { usePosture } from '../context/PostureContext';

const mockTimeSeriesData = [
  { time: '09:00', angle: 10, target: 15 }, // good
  { time: '10:00', angle: 12, target: 15 },
  { time: '11:00', angle: 18, target: 15 }, // warning
  { time: '12:00', angle: 14, target: 15 },
  { time: '13:00', angle: 11, target: 15 }, // lunch
  { time: '14:00', angle: 22, target: 15 }, // danger (post-lunch dip)
  { time: '15:00', angle: 28, target: 15 }, // danger
  { time: '16:00', angle: 15, target: 15 },
  { time: '17:00', angle: 19, target: 15 },
  { time: '18:00', angle: 25, target: 15 },
];

const mockWeeklyData = [
  { day: '월', badTime: 120 },
  { day: '화', badTime: 95 },
  { day: '수', badTime: 110 },
  { day: '목', badTime: 180 }, // peak
  { day: '금', badTime: 85 },
];

export const Dashboard: React.FC = () => {
  const [showWizard, setShowWizard] = useState(false);
  const { warningsCount } = usePosture();

  useEffect(() => {
    // Check if we need to show the wizard after signup
    const shouldShowWizard = localStorage.getItem('showSetupWizard');
    if (shouldShowWizard === 'true') {
      setShowWizard(true);
      // Clear the flag so it doesn't reappear on refresh
      localStorage.removeItem('showSetupWizard');
    }
  }, []);

  return (
    <div className="flex-1 p-3 lg:p-4 overflow-hidden bg-slate-50 relative flex flex-col">
      {showWizard && <CameraSetupWizard onClose={() => setShowWizard(false)} />}
      <div className="max-w-[1600px] mx-auto w-full flex flex-col flex-1 gap-3 min-h-0">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 shrink-0">
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">자세 모니터링 대시보드</h1>
            <p className="text-slate-500 mt-0.5 text-sm font-medium">오늘도 바른 자세로 건강한 하루를 시작하세요.</p>
          </div>
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm shrink-0">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-600">
              {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
            </span>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
          <StatCard
            icon={<Clock className="w-5 h-5 text-blue-500" />}
            title="오늘 바른 자세 유지 시간"
            value="4시간 32분"
            trend="+15%"
            trendColor="text-emerald-500"
            bgColor="bg-blue-50"
          />
          <StatCard
            icon={<ShieldAlert className="w-5 h-5 text-amber-500" />}
            title="자세 경고 횟수"
            value={`${warningsCount}회`}
            trend="안정적"
            trendColor="text-emerald-500"
            bgColor="bg-amber-50"
          />
          <StatCard
            icon={<Activity className="w-5 h-5 text-red-500" />}
            title="평균 목 꺾임 각도"
            value="16.5°"
            trend="주의 필요"
            trendColor="text-red-500"
            bgColor="bg-red-50"
          />
          <StatCard
            icon={<Award className="w-5 h-5 text-purple-500" />}
            title="연속 달성일"
            value="5일"
            trend="최고 기록!"
            trendColor="text-purple-500"
            bgColor="bg-purple-50"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 flex-1 min-h-0 items-stretch">

          {/* Chart Section */}
          <div className="lg:col-span-2 flex flex-col gap-3 min-h-0">
            {/* Daily Timeline Area Chart */}
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col flex-1 min-h-0">
              <div className="flex items-center justify-between mb-3 shrink-0">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">오늘의 자세 모니터링 (목 꺾임 각도)</h3>
                  <p className="text-xs text-slate-500 mt-0.5">15도 이상 시 자세 주의, 20도 이상 시 위험</p>
                </div>
                <div className="px-2 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-xs font-semibold text-indigo-600 hidden sm:flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                  실시간 분석 중
                </div>
              </div>
              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
                  <AreaChart data={mockTimeSeriesData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAngleTimeSeries" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorTargetTimeSeries" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis key="xaxis-time" dataKey="time" stroke="#cbd5e1" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis key="yaxis-time" stroke="#cbd5e1" fontSize={11} tickLine={false} axisLine={false} />
                    <CartesianGrid key="grid-time" strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <Tooltip
                      key="tooltip-time"
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                    />
                    <Legend key="legend-time" iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                    <Area key="area-angle" type="monotone" name="내 자세 각도" dataKey="angle" stroke="#ef4444" fillOpacity={1} fill="url(#colorAngleTimeSeries)" strokeWidth={3} />
                    <Area key="area-target" type="monotone" name="권장 최대 각도 (15°)" dataKey="target" stroke="#10b981" strokeDasharray="5 5" fillOpacity={1} fill="url(#colorTargetTimeSeries)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Weekly Bar Chart */}
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col flex-1 min-h-0">
              <div className="flex items-center justify-between mb-3 shrink-0">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">요일별 자세 불량 시간 누적</h3>
                  <p className="text-xs text-slate-500 mt-0.5">목요일에 가장 피로도가 높아 자세가 무너집니다.</p>
                </div>
              </div>
              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
                  <BarChart data={mockWeeklyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <XAxis key="xaxis-weekly" dataKey="day" stroke="#cbd5e1" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis key="yaxis-weekly" stroke="#cbd5e1" fontSize={11} tickLine={false} axisLine={false} />
                    <CartesianGrid key="grid-weekly" strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <Tooltip
                      key="tooltip-weekly"
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar key="bar-bad-time" name="불량 자세 시간 (분)" dataKey="badTime" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-3 min-h-0">
            {/* Live Camera Feed */}
            <div className="flex-1 min-h-0 w-full flex flex-col">
              <LiveCamera />
            </div>

            {/* Sensor Status Card */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 flex flex-col flex-1 min-h-0 w-full overflow-hidden">
              <div className="p-4 flex items-center border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-indigo-500" />
                  <h3 className="font-bold text-slate-800 text-sm">물리 센서 허브</h3>
                </div>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center text-slate-400 p-4">
                <Cpu className="w-8 h-8 text-slate-300" />
                <p className="text-sm font-medium">물리 센서 연동 기능은 준비 중입니다.</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

// Sub-component for Quick Stats
const StatCard: React.FC<{
  icon: React.ReactNode,
  title: string,
  value: string,
  trend: string,
  trendColor: string,
  bgColor: string
}> = ({ icon, title, value, trend, trendColor, bgColor }) => (
  <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-3">
    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${bgColor}`}>
      {icon}
    </div>
    <div className="min-w-0">
      <h4 className="text-xs font-semibold text-slate-500 truncate">{title}</h4>
      <span className="text-lg font-black text-slate-800 tracking-tight truncate block">{value}</span>
      <p className={`text-[10px] font-bold truncate ${trendColor}`}>{trend}</p>
    </div>
  </div>
);