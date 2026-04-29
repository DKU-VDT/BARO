import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router';
import { User, Bell, Bluetooth, LogOut, AlertTriangle, Trash2, Monitor, Volume2, Loader2 } from 'lucide-react';
import { CameraSetupWizard } from './CameraSetupWizard';

const TOKEN_KEY = 'baro_token';

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? '요청 실패');
  return data;
}

// ─────────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────────
interface Settings {
  push_enabled: boolean;
  sound_enabled: boolean;
}

// ─────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────────────────────
export const SettingsPage: React.FC = () => {
  const { user, updateProfile, logout, deleteAccount } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'sensor'>('profile');

  // 마이페이지
  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // 알림 설정
  const [settings, setSettings] = useState<Settings>({ push_enabled: true, sound_enabled: true });
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  // ── 초기 데이터 로드 ──────────────────────────────────────
  useEffect(() => {
    apiFetch('/settings').then(({ settings: s }) => {
      setSettings({ push_enabled: s.push_enabled, sound_enabled: s.sound_enabled });
      setSettingsLoaded(true);
    }).catch(console.error);
  }, []);

  // ── 마이페이지 저장 ───────────────────────────────────────
  const handleSaveProfile = async () => {
    setIsSaving(true);
    setProfileMsg('');
    try {
      if (name !== user?.name) {
        await updateProfile(name);
      }
      if (newPassword) {
        await apiFetch('/auth/password', {
          method: 'PATCH',
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        setCurrentPassword('');
        setNewPassword('');
      }
      setProfileMsg('저장되었습니다.');
      setIsEditing(false);
    } catch (err) {
      setProfileMsg(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setName(user?.name || '');
    setCurrentPassword('');
    setNewPassword('');
    setProfileMsg('');
    setIsEditing(false);
  };

  const handleLogout = () => { logout(); navigate('/login'); };
  const handleDeleteAccount = async () => { await deleteAccount(); navigate('/login'); };

  // ── 알림 설정 토글 ────────────────────────────────────────
  const toggleSetting = async (key: keyof Settings) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    apiFetch('/settings', {
      method: 'PATCH',
      body: JSON.stringify({ pushEnabled: next.push_enabled, soundEnabled: next.sound_enabled }),
    }).catch(() => setSettings(settings)); // 실패 시 롤백
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      <div className="px-8 py-6 bg-white border-b border-slate-200 shrink-0">
        <h1 className="text-2xl font-black text-slate-800">설정</h1>
        <p className="text-slate-500 mt-1 font-medium">계정 정보 및 앱 환경을 설정하세요.</p>
      </div>

      <div className="flex-1 overflow-hidden p-6 md:p-8 flex flex-col">
        <div className="max-w-4xl mx-auto w-full h-full flex flex-col md:flex-row gap-6 md:gap-8 min-h-0">

          {/* 사이드바 */}
          <div className="w-full md:w-64 shrink-0">
            <nav className="flex flex-col space-y-1">
              <TabButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<User />} label="마이페이지" />
              <TabButton active={activeTab === 'sensor'} onClick={() => setActiveTab('sensor')} icon={<Bluetooth />} label="물리 센서 연동" />
              <TabButton active={activeTab === 'notifications'} onClick={() => setActiveTab('notifications')} icon={<Bell />} label="알림 및 환경" />
            </nav>
          </div>

          {/* 콘텐츠 */}
          <div className="flex-1 min-w-0 h-full flex flex-col relative">
            <div className="bg-white rounded-2xl p-6 md:p-8 border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col relative">

              {/* ── 마이페이지 ── */}
              {activeTab === 'profile' && (
                <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300 min-h-0">
                  <h2 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-4 mb-6 shrink-0">마이페이지</h2>
                  <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                    <div className="flex items-center gap-5 mb-8 shrink-0 px-2">
                      <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center border-2 border-white shadow-md shrink-0">
                        <User className="w-10 h-10 text-indigo-500" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-slate-800">{user?.name}</h3>
                        <p className="text-slate-500 font-medium mt-1">{user?.email}</p>
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col min-h-0">
                      <div className="flex items-center justify-between mb-3 px-2 shrink-0">
                        <h3 className="font-bold text-slate-800">계정 정보 설정</h3>
                        {!isEditing && (
                          <button
                            onClick={() => setIsEditing(true)}
                            className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                          >
                            편집
                          </button>
                        )}
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-1 mb-4 shrink-0">
                        <div className="flex items-center p-3.5 border-b border-slate-200/60">
                          <span className="text-sm font-bold text-slate-700 w-28">이름</span>
                          {isEditing ? (
                            <input
                              type="text"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              className="flex-1 bg-transparent text-right font-bold text-slate-900 focus:outline-none"
                            />
                          ) : (
                            <span className="flex-1 text-right font-bold text-slate-900">{user?.name}</span>
                          )}
                        </div>
                        <div className="flex items-center p-3.5 border-b border-slate-200/60">
                          <span className="text-sm font-bold text-slate-700 w-28">이메일</span>
                          <span className="flex-1 text-right font-medium text-slate-400">{user?.email}</span>
                        </div>
                        {isEditing && (
                          <>
                            <div className="flex items-center p-3.5 border-b border-slate-200/60">
                              <span className="text-sm font-bold text-slate-700 w-28">현재 비밀번호</span>
                              <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="현재 비밀번호"
                                className="flex-1 bg-transparent text-right font-medium text-slate-900 focus:outline-none placeholder-slate-400"
                              />
                            </div>
                            <div className="flex items-center p-3.5">
                              <span className="text-sm font-bold text-slate-700 w-28">새 비밀번호</span>
                              <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="8자 이상"
                                className="flex-1 bg-transparent text-right font-medium text-slate-900 focus:outline-none placeholder-slate-400"
                              />
                            </div>
                          </>
                        )}
                      </div>

                      {profileMsg && (
                        <p className={`text-sm font-bold mb-3 px-1 ${profileMsg === '저장되었습니다.' ? 'text-emerald-600' : 'text-red-500'}`}>
                          {profileMsg}
                        </p>
                      )}

                      {isEditing && (
                        <div className="flex gap-3 shrink-0">
                          <button
                            onClick={handleCancelEdit}
                            className="flex-1 py-3.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                          >
                            취소
                          </button>
                          <button
                            onClick={handleSaveProfile}
                            disabled={isSaving}
                            className="flex-1 py-3.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm flex items-center justify-center gap-2"
                          >
                            {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> 저장 중...</> : '저장'}
                          </button>
                        </div>
                      )}

                      <div className="mt-auto pt-6 flex items-center justify-between border-t border-slate-100 shrink-0 px-2">
                        <button onClick={handleLogout} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 font-bold transition-colors text-sm py-2">
                          <LogOut className="w-4 h-4" /> 로그아웃
                        </button>
                        <button onClick={() => setShowDeleteConfirm(true)} className="text-slate-400 hover:text-red-500 text-sm font-medium transition-colors py-2 underline underline-offset-2">
                          계정 탈퇴
                        </button>
                      </div>
                    </div>
                  </div>

                  {showDeleteConfirm && (
                    <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-2xl p-8 animate-in fade-in zoom-in-95">
                      <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                        <AlertTriangle className="w-8 h-8" />
                      </div>
                      <h3 className="text-xl font-black text-slate-800 mb-2">정말로 탈퇴하시겠습니까?</h3>
                      <p className="text-slate-500 text-center mb-8 max-w-sm">계정을 삭제하면 모든 데이터가 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다.</p>
                      <div className="flex gap-3 w-full max-w-xs">
                        <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors">취소</button>
                        <button onClick={handleDeleteAccount} className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-2 shadow-sm">
                          <Trash2 className="w-4 h-4" /> 탈퇴하기
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── 물리 센서 연동 ── */}
              {activeTab === 'sensor' && (
                <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300 overflow-y-auto pr-2">
                  <h2 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-4 mb-6 shrink-0">물리 센서 연동 (옵션)</h2>
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center text-slate-400">
                    <Bluetooth className="w-12 h-12 text-slate-300" />
                    <p className="font-medium">물리 센서 연동 기능은 준비 중입니다.</p>
                  </div>
                </div>
              )}

              {/* ── 알림 및 환경 ── */}
              {activeTab === 'notifications' && (
                <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300 overflow-y-auto pr-2">
                  <h2 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-4 mb-6 shrink-0">알림 및 환경</h2>
                  {!settingsLoaded ? (
                    <div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
                  ) : (
                    <div className="space-y-6 pb-6">
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-white rounded-lg shadow-sm text-slate-500"><Bell className="w-5 h-5" /></div>
                          <div>
                            <p className="font-bold text-slate-800">스트레칭 푸시 알림</p>
                            <p className="text-sm text-slate-500">자세 불량이 감지되면 시스템 푸시 알림을 보냅니다.</p>
                          </div>
                        </div>
                        <Toggle checked={settings.push_enabled} onChange={() => toggleSetting('push_enabled')} />
                      </div>

                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-white rounded-lg shadow-sm text-slate-500"><Volume2 className="w-5 h-5" /></div>
                          <div>
                            <p className="font-bold text-slate-800">경고음 재생</p>
                            <p className="text-sm text-slate-500">자세 경고 시 스피커로 경고음을 재생합니다.</p>
                          </div>
                        </div>
                        <Toggle checked={settings.sound_enabled} onChange={() => toggleSetting('sound_enabled')} />
                      </div>

                      <div className="pt-4 border-t border-slate-100 space-y-4">
                        <h3 className="font-bold text-slate-800 mb-4">카메라 환경 세팅</h3>
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
                          <div className="flex items-start gap-4">
                            <div className="p-3 bg-white rounded-lg shadow-sm text-indigo-500 shrink-0"><Monitor className="w-6 h-6" /></div>
                            <div className="flex-1">
                              <h4 className="font-bold text-slate-800 text-lg mb-1">AI 자세 분석 최적화 가이드</h4>
                              <p className="text-sm text-slate-600 leading-relaxed mb-4">더 정확한 AI 자세 분석을 위해 카메라 각도와 모니터 높이를 조정해보세요.</p>
                              <button onClick={() => setShowWizard(true)} className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-colors shadow-sm">
                                카메라 각도 세팅 마법사 시작
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {showWizard && <CameraSetupWizard onClose={() => setShowWizard(false)} />}
    </div>
  );
};

// ── UI 컴포넌트 ──────────────────────────────────────────────
const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-left ${active ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
    {React.cloneElement(icon as React.ReactElement<{ className: string }>, { className: 'w-5 h-5' })}
    {label}
  </button>
);

const Toggle: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => (
  <button onClick={onChange} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${checked ? 'bg-indigo-600' : 'bg-slate-200'}`}>
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
  </button>
);
