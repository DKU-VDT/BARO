import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router';
import { Mail, Lock, User, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export const Signup: React.FC = () => {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // 이메일 인증 상태
  const [isVerificationSent, setIsVerificationSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [verificationError, setVerificationError] = useState('');

  const handleSendVerification = async () => {
    if (!email) return;
    setIsSendingCode(true);
    setVerificationError('');
    try {
      const res = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setIsVerificationSent(true);
    } catch (err) {
      setVerificationError(err instanceof Error ? err.message : '전송에 실패했습니다.');
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode) return;
    setIsVerifyingCode(true);
    setVerificationError('');
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: verificationCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setIsVerified(true);
    } catch (err) {
      setVerificationError(err instanceof Error ? err.message : '인증에 실패했습니다.');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isVerified) {
      setFormError('이메일 인증을 먼저 완료해주세요.');
      return;
    }
    setFormError('');
    setIsLoading(true);
    try {
      localStorage.setItem('showSetupWizard', 'true');
      await signup(email, name, password);
      navigate('/');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '회원가입에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center mb-8 gap-4">
        <Link to="/login" className="p-2 hover:bg-slate-50 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </Link>
        <h2 className="text-2xl font-black text-slate-800 flex-1 text-center -ml-9">회원가입</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {formError && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {formError}
          </div>
        )}

        <div>
          <label htmlFor="name" className="block text-sm font-bold text-slate-700">이름</label>
          <div className="mt-2 relative rounded-xl shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-slate-400" />
            </div>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block w-full pl-10 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-medium transition-colors"
              placeholder="홍길동"
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-bold text-slate-700">이메일</label>
          <div className="mt-2 flex gap-2">
            <div className="relative rounded-xl shadow-sm flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-400" />
              </div>
              <input
                id="email"
                name="email"
                type="email"
                required
                disabled={isVerified}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-medium transition-colors disabled:opacity-60 disabled:bg-slate-100 disabled:text-slate-500"
                placeholder="you@example.com"
              />
            </div>
            <button
              type="button"
              onClick={handleSendVerification}
              disabled={isSendingCode || !email || isVerified}
              className="px-4 py-3 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-slate-800 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors disabled:opacity-50 whitespace-nowrap min-w-[120px]"
            >
              {isSendingCode ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (isVerificationSent ? '재전송' : '인증번호 받기')}
            </button>
          </div>
        </div>

        {isVerificationSent && !isVerified && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300">
            <label htmlFor="verificationCode" className="block text-sm font-bold text-slate-700">인증번호</label>
            <div className="mt-2 flex gap-2">
              <input
                id="verificationCode"
                type="text"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-bold transition-colors text-center tracking-widest text-lg"
                placeholder="6자리 숫자"
              />
              <button
                type="button"
                onClick={handleVerifyCode}
                disabled={isVerifyingCode || verificationCode.length !== 6}
                className="px-4 py-3 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 whitespace-nowrap min-w-[120px]"
              >
                {isVerifyingCode ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : '확인'}
              </button>
            </div>
            {verificationError && (
              <p className="mt-2 text-sm text-red-500 font-bold">{verificationError}</p>
            )}
          </div>
        )}

        {isVerified && (
          <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-200 animate-in fade-in duration-300">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm font-bold">이메일 인증이 완료되었습니다.</span>
          </div>
        )}

        <div>
          <label htmlFor="password" className="block text-sm font-bold text-slate-700">비밀번호</label>
          <div className="mt-2 relative rounded-xl shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-slate-400" />
            </div>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full pl-10 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-medium transition-colors"
              placeholder="•••••••• (8자 이상)"
              minLength={8}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || !isVerified}
          className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-black text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : '가입하기'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500 font-medium">
        가입 시 <a href="#" className="font-bold text-indigo-600 hover:text-indigo-500">이용약관</a> 및 <a href="#" className="font-bold text-indigo-600 hover:text-indigo-500">개인정보처리방침</a>에 동의하는 것으로 간주합니다.
      </p>
    </div>
  );
};
