import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquareIcon, PlusCircleIcon, MenuIcon, PanelLeftCloseIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import GitHubButton from 'react-github-btn';
import '@fontsource/audiowide';
import { UserSection } from './UserSection';
import { request } from '@/utils/request';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { Group } from '@/config/groups';

// 根据群组ID生成固定的随机颜色
const getRandomColor = (index: number) => {
  const colors = ['blue', 'green', 'yellow', 'purple', 'pink', 'indigo', 'red', 'orange', 'teal'];
  //增加hash
  const hashCode = index.toString().split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);
  return colors[hashCode % colors.length];
};

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  selectedGroupIndex?: number;
  onSelectGroup?: (index: number) => void;
  groups: Group[];
}

const Sidebar = ({ isOpen, toggleSidebar, selectedGroupIndex = 0, onSelectGroup, groups }: SidebarProps) => {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast.error('请输入群名');
      return;
    }
    setCreating(true);
    try {
      const response = await request('/api/claw/create', {
        method: 'POST',
        body: JSON.stringify({ name: groupName.trim(), description: groupDesc.trim() })
      });
      const data = await response.json();
      if (data.success) {
        toast.success('创建成功');
        setShowCreateDialog(false);
        setGroupName('');
        setGroupDesc('');
        window.location.href = `/?id=${groups.length}`;
      } else {
        toast.error(data.message || '创建失败');
      }
    } catch (error) {
      toast.error('创建失败，请重试');
    }
    setCreating(false);
  };
  
  return (
    <>
      {/* 创建群聊弹窗 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>创建龙虾群聊</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">群名称</label>
              <Input
                placeholder="给你的龙虾群起个名字"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                maxLength={30}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">群描述（选填）</label>
              <Input
                placeholder="简单描述一下这个群"
                value={groupDesc}
                onChange={(e) => setGroupDesc(e.target.value)}
                maxLength={100}
              />
            </div>
            <Button
              onClick={handleCreateGroup}
              disabled={creating || !groupName.trim()}
              className="w-full bg-[#ff6600] hover:bg-[#e65c00] text-white"
            >
              {creating ? (
                <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : null}
              创建群聊
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* 侧边栏 - 在移动设备上可以隐藏，在桌面上始终显示 */}
      <div 
        className={cn(
          "transition-all duration-300 ease-in-out",
          "fixed md:relative z-20 h-full",
          isOpen ? "w-48 translate-x-0" : "w-0 md:w-14 -translate-x-full md:translate-x-0"
        )}
      >
        <div className="h-full border-r bg-background rounded-l-lg overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/40">
            <div className="flex-1 flex items-center">
              <span className={cn(
                "font-medium text-base text-foreground/90 transition-all duration-200 whitespace-nowrap overflow-hidden",
                isOpen ? "opacity-100 max-w-full mr-2 pl-3" : "opacity-0 max-w-0 md:max-w-0"
              )}>
                群列表
              </span>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleSidebar}
                className={cn(
                  "text-muted-foreground hover:text-primary",
                  isOpen ? "ml-auto" : "mx-auto md:ml-auto"
                )}
              >
                {isOpen ? <PanelLeftCloseIcon className="h-4 w-4" /> : <MenuIcon className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto p-2">
            <nav className="space-y-1.5">
              {groups.map((group, index) => (
                <a 
                  key={group.id}
                  href="#" 
                  onClick={(e) => {
                    e.preventDefault();
                    onSelectGroup?.(index);
                  }}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-3 py-2.5 text-sm font-medium transition-all hover:bg-accent/80 group",
                    !isOpen && "md:justify-center",
                    selectedGroupIndex === index && "bg-accent"
                  )}
                >
                  <MessageSquareIcon 
                    className={`h-5 w-5 flex-shrink-0 group-hover:opacity-80 text-${getRandomColor(index)}-500 group-hover:text-${getRandomColor(index)}-600`} 
                  />
                  <span className={cn(
                    "transition-all duration-200 whitespace-nowrap overflow-hidden text-foreground/90",
                    isOpen ? "opacity-100 max-w-full" : "opacity-0 max-w-0 md:max-w-0"
                  )}>{group.name}</span>
                </a>
              ))}
              
              <a 
                      href="#" 
                      className={cn(
                        "flex items-center gap-1 rounded-md px-3 py-2.5 text-sm font-medium transition-all hover:bg-accent/80 group mt-3",
                        !isOpen && "md:justify-center"
                      )}
                      onClick={(e) => {
                        e.preventDefault();
                        setShowCreateDialog(true);
                      }}
                    >
                      <PlusCircleIcon className="h-5 w-5 flex-shrink-0 text-amber-500 group-hover:text-amber-600" />
                      <span className={cn(
                        "transition-all duration-200 whitespace-nowrap overflow-hidden text-foreground/90",
                        isOpen ? "opacity-100 max-w-full" : "opacity-0 max-w-0 md:max-w-0"
                      )}>创建新群聊</span>
                    </a>
            </nav>
          </div>
          
          {/* 广告位 
          <AdSection isOpen={isOpen} />
          */}

          {/* 用户信息模块 */}
          <UserSection isOpen={isOpen} />

          {/* GitHub Star Button - 只在侧边栏打开时显示，放在底部 */}
          <div className="px-3 py-2 mt-auto">
            {/* 标题移至底部 */}
            <div className="flex items-center justify-left mb-3">
              <a href="/" className="flex items-center">
                <span 
                  style={{ fontFamily: 'Audiowide, system-ui', color: '#ff6600' }} 
                  className={cn(
                    "transition-all duration-200 whitespace-nowrap overflow-hidden",
                    isOpen ? "text-lg" : "text-xs max-w-0 opacity-0 md:max-w-0"
                  )}
                >
                  botgroup.chat
                </span>
                {isOpen && (
                  <span className="text-[10px] text-gray-400 ml-1 self-end mb-0.5">{__APP_VERSION__}</span>
                )}
              </a>
            </div>
            
            {isOpen && (
              <div className="flex items-center justify-left h-8">
                <GitHubButton 
                  href="https://github.com/maojindao55/botgroup.chat"
                  data-color-scheme="no-preference: light; light: light; dark: light;"
                  data-size="large"
                  data-show-count="true"
                  aria-label="Star maojindao55/botgroup.chat on GitHub"
                >
                  Star
                </GitHubButton>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* 移动设备上的遮罩层，点击时关闭侧边栏 */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-10 md:hidden" 
          onClick={toggleSidebar}
        />
      )}
    </>
  );
};

export default Sidebar; 