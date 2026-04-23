import React from 'react';
import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../context/AuthContext';

export const AuthLayout: React.FC = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (user) {
    return <Navigate to="/" replace />;
  }
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center mb-8">
        <h1 className="text-4xl font-black text-indigo-600 tracking-tighter flex items-center gap-2 mb-2">
          <span className="text-5xl">🐢</span> BARO
        </h1>
        <p className="text-slate-500 font-medium text-center px-4">
          올바른 자세를 지키고 건강한 습관을 만들어보세요!
        </p>
      </div>
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm border border-slate-200 sm:rounded-2xl sm:px-10">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
