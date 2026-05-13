"use client";

/**
 * 夜空風 site footer — 取代 SiteFooter 在三個夜空風頁面的視覺
 * Made with ❤️ by 阿凱老師（觸發 skill: akai-author-footer）
 */
import Link from 'next/link';
import {nightTokens as t} from './atoms';

const TEACHER_PAGE = 'https://www.smes.tyc.edu.tw/';
const GITHUB_URL = 'https://github.com/cagoooo/PhotoPoet';

export function NightSiteFooter() {
  const year = new Date().getFullYear();
  const sha = process.env.NEXT_PUBLIC_BUILD_SHA;
  return (
    <footer
      style={{
        textAlign: 'center',
        fontSize: 10,
        color: t.inkFaint,
        marginTop: 28,
        padding: '0 12px 24px',
        letterSpacing: 1.5,
        lineHeight: 1.9,
      }}
    >
      <div>
        <span style={{color: t.inkMute}}>made with </span>
        <span style={{color: '#d97a8a'}}>♡</span>
        <span style={{color: t.inkMute}}> by </span>
        <a
          href={TEACHER_PAGE}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: t.gold,
            fontFamily: t.serif,
            textDecoration: 'none',
          }}
        >
          阿凱老師
        </a>
        <span style={{color: t.inkFaint}}> · 桃園市石門國小 · </span>
        <Link
          href="/wall"
          style={{
            color: t.inkSoft,
            textDecoration: 'none',
          }}
        >
          詩牆
        </Link>
        <span style={{color: t.inkFaint}}> · </span>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: t.inkSoft,
            textDecoration: 'none',
          }}
        >
          GitHub
        </a>
      </div>
      <div style={{marginTop: 4}}>
        © {year} 點亮詩意 Pro
        {sha && (
          <span style={{marginLeft: 6, color: t.inkFaint}} title={`Build commit: ${sha}`}>
            · build {sha.slice(0, 7)}
          </span>
        )}
      </div>
    </footer>
  );
}
