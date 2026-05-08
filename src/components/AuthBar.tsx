"use client";

import Link from 'next/link';
import {Button} from '@/components/ui/button';
import {useAuth} from '@/hooks/useAuth';
import {LogIn, LogOut, History} from 'lucide-react';

interface AuthBarProps {
  remaining?: number | null;
  dailyLimit?: number | null;
  showHistoryLink?: boolean;
}

export function AuthBar({remaining, dailyLimit, showHistoryLink = true}: AuthBarProps) {
  const {user, loading, configured, signIn, signOutUser} = useAuth();

  if (!configured) return null;
  if (loading) {
    return <div className="text-sm text-gray-500 text-center py-2">載入中…</div>;
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center gap-2 py-2">
        <Button
          onClick={() => signIn().catch(e => console.error(e))}
          className="bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 shadow-sm"
        >
          <LogIn className="h-4 w-4 mr-2" />
          以 Google 帳號登入
        </Button>
        <p className="text-xs text-gray-500">登入後每日可生成 {dailyLimit ?? 20} 首詩</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2 px-1">
      <div className="flex items-center gap-2 min-w-0">
        {user.photoURL && (
          <img src={user.photoURL} alt={user.displayName ?? ''} className="w-8 h-8 rounded-full" />
        )}
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{user.displayName ?? user.email}</div>
          {typeof remaining === 'number' && typeof dailyLimit === 'number' && (
            <div className="text-xs text-gray-500">今日剩餘 {remaining} / {dailyLimit}</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {showHistoryLink && (
          <Link
            href="/history"
            className="inline-flex items-center text-xs text-purple-700 hover:text-purple-900 hover:underline px-2 py-1 rounded"
            aria-label="我的詩歷史"
          >
            <History className="h-4 w-4 mr-1" />
            我的詩
          </Link>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOutUser()}
          className="text-gray-600 hover:text-gray-900"
        >
          <LogOut className="h-4 w-4 mr-1" />
          登出
        </Button>
      </div>
    </div>
  );
}
