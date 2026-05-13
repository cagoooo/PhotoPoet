"use client";

/**
 * 夜空風使用者列 — 取代舊版 AuthBar 在首頁的視覺
 * 對應 prototype screen-home.jsx 的「user row」
 */
import Link from 'next/link';
import {useAuth} from '@/hooks/useAuth';
import {nightTokens as t} from './atoms';

interface NightAuthBarProps {
  remaining?: number | null;
  dailyLimit?: number | null;
}

export function NightAuthBar({remaining, dailyLimit}: NightAuthBarProps) {
  const {user, loading, configured, signIn, signOutUser} = useAuth();

  if (!configured) return null;

  if (loading) {
    return (
      <div
        style={{
          fontFamily: t.italic,
          fontStyle: 'italic',
          fontSize: 11,
          color: t.inkMute,
          letterSpacing: 1,
          padding: '10px 0',
        }}
      >
        loading ⸺
      </div>
    );
  }

  if (!user) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: 11.5,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #2a3148, #1c2235)',
            border: `1px solid ${t.panelBorder}`,
            color: t.gold,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: t.serif,
            fontSize: 14,
          }}
        >
          ☾
        </div>
        <div style={{flex: 1, minWidth: 0}}>
          <div style={{fontFamily: t.serif, fontSize: 13, color: t.ink}}>
            未登入
          </div>
          <div style={{fontSize: 10, color: t.inkMute, letterSpacing: 1}}>
            登入後每日可賦詩 {dailyLimit ?? 20} 首
          </div>
        </div>
        <button
          onClick={() => signIn().catch(e => console.error(e))}
          style={{
            background: 'transparent',
            border: `1px solid ${t.gold}`,
            color: t.gold,
            padding: '7px 14px',
            fontFamily: t.italic,
            fontStyle: 'italic',
            fontSize: 11,
            letterSpacing: 1.5,
            cursor: 'pointer',
            transition: 'all .2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(184,154,74,0.10)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          sign in ↗
        </button>
      </div>
    );
  }

  const name = user.displayName?.split(' ')[0] || user.email?.split('@')[0] || '詩人';
  const initial = name.charAt(0);
  const remainingNum = typeof remaining === 'number' ? remaining : null;
  const limitNum = typeof dailyLimit === 'number' ? dailyLimit : 20;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 11.5,
        marginBottom: 18,
      }}
    >
      {user.photoURL ? (
        <img
          src={user.photoURL}
          alt={name}
          referrerPolicy="no-referrer"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: `1px solid ${t.panelBorder}`,
            objectFit: 'cover',
          }}
        />
      ) : (
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #2a3148, #1c2235)',
            border: `1px solid ${t.panelBorder}`,
            color: t.gold,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: t.serif,
            fontSize: 14,
          }}
        >
          {initial}
        </div>
      )}
      <div style={{flex: 1, minWidth: 0}}>
        <div
          style={{
            fontFamily: t.serif,
            fontSize: 13,
            color: t.ink,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {name}
        </div>
        <div style={{fontSize: 10, color: t.inkMute, letterSpacing: 1}}>
          tonight · {remainingNum ?? '—'} of {limitNum}
        </div>
      </div>
      <Link
        href="/history"
        style={{
          fontSize: 11,
          color: t.gold,
          fontFamily: t.italic,
          fontStyle: 'italic',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        my poems ↗
      </Link>
      <button
        onClick={() => signOutUser().catch(e => console.error(e))}
        title="登出"
        style={{
          background: 'transparent',
          border: 0,
          color: t.inkMute,
          fontSize: 14,
          marginLeft: 4,
          cursor: 'pointer',
          padding: 0,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.color = t.gold;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = t.inkMute;
        }}
      >
        ⤴
      </button>
    </div>
  );
}
