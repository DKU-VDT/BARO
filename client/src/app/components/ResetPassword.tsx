import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router';
import { Lock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!token) {
    return (
      <div className="text-center space-y-6">
        <div className="flex justify-center mt-4">
          <AlertCircle className="w-16 h-16 text-red-400" />
        </div>
        <div className="bg-red-50 p-4 rounded-xl border border-red-100">
          <p className="text-red-800 font-medium">유효하지 않은 링크입니다.</p>
        </div>
        <Link
          to="/find-password"
          className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-black text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
        >
          비밀번호 찾기로 이동
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (newPassword.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || '오류가 발생했습니다.');
      setIsSuccess(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="text-center space-y-6">
        <div className="flex justify-center mt-4">
          <CheckCircle2 className="w-16 h-16 text-emerald-500" />
        </div>
        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
          <p className="text-emerald-800 font-medium">비밀번호가 재설정되었습니다.</p>
        </div>
        <p className="text-sm text-slate-500 font-medium">잠시 후 로그인 화면으로 이동합니다.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-black text-slate-800 text-center mb-4">새 비밀번호 설정</h2>
      <p className="text-slate-500 text-sm text-center mb-8 font-medium">
        새로 사용할 비밀번호를 입력해주세요.
      </p>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="newPassword" className="block text-sm font-bold text-slate-700">새 비밀번호</label>
          <div className="mt-2 relative rounded-xl shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-slate-400" />
            </div>
            <input
              id="newPassword"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="block w-full pl-10 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-medium transition-colors"
              placeholder="8자 이상 입력"
            />
          </div>
        </div>
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-bold text-slate-700">비밀번호 확인</label>
          <div className="mt-2 relative rounded-xl shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-slate-400" />
            </div>
            <input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="block w-full pl-10 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-medium transition-colors"
              placeholder="비밀번호 재입력"
            />
          </div>
        </div>
        {error && (
          <p className="text-sm text-red-600 font-medium text-center">{error}</p>
        )}
        <button
          type="submit"
          disabled={isLoading || !newPassword || !confirmPassword}
          className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-black text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : '비밀번호 재설정'}
        </button>
      </form>
    </div>
  );
};
