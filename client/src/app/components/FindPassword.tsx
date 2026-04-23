import React, { useState } from 'react';
import { Link } from 'react-router';
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';

export const FindPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || '오류가 발생했습니다.');
      }
      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-black text-slate-800 text-center mb-4">비밀번호 찾기</h2>
      
      {isSuccess ? (
        <div className="text-center space-y-6">
          <div className="flex justify-center mt-4">
            <CheckCircle2 className="w-16 h-16 text-emerald-500" />
          </div>
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
            <p className="text-emerald-800 font-medium">
              <span className="font-bold">{email}</span>으로<br />
              비밀번호 재설정 링크가 전송되었습니다.
            </p>
          </div>
          <p className="text-sm text-slate-500 font-medium">
            이메일이 도착하지 않았나요? 스팸함을 확인하거나 다시 시도해 주세요.
          </p>
          <div className="pt-4">
            <Link
              to="/login"
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-black text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              로그인 화면으로 돌아가기
            </Link>
          </div>
        </div>
      ) : (
        <>
          <p className="text-slate-500 text-sm text-center mb-8 font-medium">
            가입 시 사용한 이메일 주소를 입력하시면<br />비밀번호 재설정 링크를 보내드립니다.
          </p>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-bold text-slate-700">이메일</label>
              <div className="mt-2 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-medium transition-colors"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 font-medium text-center">{error}</p>
            )}
            <button
              type="submit"
              disabled={isLoading || !email}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-black text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : '재설정 링크 받기'}
            </button>
          </form>

          <div className="mt-8 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> 로그인으로 돌아가기
            </Link>
          </div>
        </>
      )}
    </div>
  );
};
