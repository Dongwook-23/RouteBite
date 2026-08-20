"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- next-themes 하이드레이션 안전 패턴
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex size-9 items-center justify-center rounded-lg text-stone-500 transition-colors duration-200 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
    >
      {mounted && (isDark ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />)}
    </button>
  );
}
