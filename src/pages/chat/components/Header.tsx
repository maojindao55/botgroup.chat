import React from 'react';
import GitHubButton from 'react-github-btn';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/use-theme';
import '@fontsource/audiowide';

const Header: React.FC = () => {
  const { resolvedTheme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  const colorScheme = resolvedTheme === 'dark'
    ? 'no-preference: dark; light: dark; dark: dark;'
    : 'no-preference: light; light: light; dark: light;';

  return (
    <header className="bg-transparent fixed top-0 left-0 right-0 z-50 hidden md:block">
      <div className="w-full px-2 h-10 flex items-center" >
        {/* Logo */}
        <div className="flex-1 flex items-center">
          <a href="/" className="flex items-center">
            <img src="/img/logo.svg" alt="logo" className="h-6 w-6 mr-2" />
            <span style={{ fontFamily: 'Audiowide, system-ui', color: '#ff6600' }} className="text-2xl">
              botgroup.chat
            </span>
          </a>
        </div>

        {/* Theme Toggle + GitHub Star Button */}
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
          <GitHubButton
            href="https://github.com/maojindao55/botgroup.chat"
            data-color-scheme={colorScheme}
            data-size="large"
            data-show-count="true"
            aria-label="Star maojindao55/botgroup.chat on GitHub"
          >
            Star
          </GitHubButton>
        </div>
      </div>
    </header>
  );
};

export default Header;
