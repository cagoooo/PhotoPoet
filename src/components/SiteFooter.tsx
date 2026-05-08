"use client";

/**
 * Made with ❤️ by 阿凱老師（ipad@mail2.smes.tyc.edu.tw, 桃園市石門國小）
 * 觸發 skill: akai-author-footer
 */
import {Heart} from 'lucide-react';

const TEACHER_PAGE = 'https://www.smes.tyc.edu.tw/'; // 學校教師頁/校網入口
const GITHUB_URL = 'https://github.com/cagoooo/PhotoPoet';

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-8 mb-4 max-w-md w-full px-2 text-center text-xs text-gray-600 leading-relaxed">
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <span className="inline-flex items-center">
          Made with
          <Heart className="h-3.5 w-3.5 text-pink-500 mx-1" fill="currentColor" />
          by
          <a
            href={TEACHER_PAGE}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-purple-700 hover:text-purple-900 hover:underline ml-1"
          >
            阿凱老師
          </a>
        </span>
        <span className="text-gray-400">·</span>
        <span>桃園市石門國小</span>
        <span className="text-gray-400">·</span>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-700 hover:text-purple-900 hover:underline"
        >
          GitHub
        </a>
      </div>
      <div className="mt-1 text-gray-500">© {year} PhotoPoet · 點亮詩意</div>
    </footer>
  );
}
