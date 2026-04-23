import React from 'react';
import { Outlet, NavLink } from 'react-router';
import { usePosture } from '../context/PostureContext';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, FileText, Settings, UserCircle, Menu, ShieldAlert } from 'lucide-react';
import { ScreenLock } from './ScreenLock';
import { PostureAlert } from './PostureAlert';

export const Layout: React.FC = () => {
  const { postureState, warningsCount, triggerWarning } = usePosture();
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans text-slate-900 selection:bg-indigo-200">
      
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200 shrink-0 z-20">
        <h1 className="text-xl font-black text-indigo-600 tracking-tighter flex items-center gap-1">
          <span className="text-2xl">🐢</span> BARO
        </h1>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 -mr-2">
          <Menu className="w-6 h-6 text-slate-600" />
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-slate-200 shadow-sm
        transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-full flex flex-col p-6">
          <div className="mb-10 lg:block hidden">
            <h1 className="text-2xl font-black text-indigo-600 tracking-tighter flex items-center gap-2">
              <span className="text-3xl">🐢</span> BARO
            </h1>
          </div>
          
          <nav className="flex-1 space-y-2">
            <NavItem to="/" icon={<LayoutDashboard />} label="대시보드" end />
            <NavItem to="/report" icon={<FileText />} label="주간 AI 리포트" />
            <NavItem to="/settings" icon={<Settings />} label="설정" />
          </nav>

          <div className="mt-auto space-y-3">
            {/* Temporary Button to increase warning count */}
            <button
              onClick={() => triggerWarning()}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-colors border border-slate-200 flex items-center justify-center gap-2 mb-2 shadow-sm group relative"
              title="개발용: 경고 횟수 증가 테스트"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
              경고 1회 추가 (테스트)
            </button>

            {/* Warning Status */}
            <div className="bg-red-50 rounded-2xl p-3 flex items-center justify-between border border-red-100 shadow-sm">
              <div className="flex items-center gap-2 text-red-600">
                <ShieldAlert className="w-4 h-4" />
                <span className="text-xs font-bold">자세 경고</span>
              </div>
              <span className="text-sm font-black text-red-600">{warningsCount} / 3</span>
            </div>

            {/* User Profile */}
            <div className="bg-slate-50 rounded-2xl p-3 flex items-center gap-3 border border-slate-100 shadow-sm">
              <UserCircle className="w-10 h-10 text-indigo-300 bg-indigo-50 rounded-full shrink-0" />
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-slate-700 truncate">{user?.name || "사용자"} 님</p>
                <p className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md inline-block mt-1">상태: 양호</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-white">
        <Outlet />
        <PostureAlert />
        <ScreenLock />
      </main>
      
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-slate-900/20 backdrop-blur-sm lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
};

const NavItem: React.FC<{ to: string, icon: React.ReactNode, label: string, end?: boolean }> = ({ to, icon, label, end }) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) => `
      flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all
      ${isActive 
        ? 'bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-100/50' 
        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
      }
    `}
  >
    {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'w-5 h-5' })}
    {label}
  </NavLink>
);