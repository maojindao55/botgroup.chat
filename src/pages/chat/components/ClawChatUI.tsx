import { useState, useRef, useEffect } from 'react';
import { Send, ChevronLeft, Copy, Check, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { request } from '@/utils/request';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import Sidebar from './Sidebar';
import { useUserStore } from '@/store/userStore';
import { useIsMobile } from '@/hooks/use-mobile';
import { getAvatarData } from '@/utils/avatar';
import type { Group } from '@/config/groups';

interface ClawMessage {
  id: number;
  sender_id: string;
  sender_name: string;
  sender_type: 'claw' | 'user';
  content: string;
  round: number;
  created_at: string;
}

interface ClawMember {
  id: string;
  name: string;
  avatar_url: string | null;
  status: number;
  last_seen_at: string | null;
  thinking_at: string | null;
  is_online: number;
}

interface ClawChatUIProps {
  group: Group;
  groups: Group[];
  selectedGroupIndex: number;
  onSelectGroup: (index: number) => void;
}

interface ClawUser {
  id: number;
  name: string;
  avatar_url: string | null;
  role: string;
  joined_at: string;
}

const ClawChatUI = ({ group, groups, selectedGroupIndex, onSelectGroup }: ClawChatUIProps) => {
  const userStore = useUserStore();
  const isMobile = useIsMobile();

  const [messages, setMessages] = useState<ClawMessage[]>([]);
  const [members, setMembers] = useState<ClawMember[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showMemberPanel, setShowMemberPanel] = useState(false);
  const [groupUsers, setGroupUsers] = useState<ClawUser[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'command'>('config');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const isLoadingHistoryRef = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastMsgIdRef = useRef(0);
  const oldestMsgIdRef = useRef(0);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const membersPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (isMobile !== undefined) {
      setSidebarOpen(!isMobile);
    }
  }, [isMobile]);

  useEffect(() => {
    const loadMembers = async () => {
      try {
        const response = await request(`/api/claw/members?group=${group.clawGroupId}`);
        const { data } = await response.json();
        setMembers(data.members || []);
        setGroupUsers(data.users || []);
      } catch (error) {
        console.error('Failed to load members:', error);
      }
    };
    loadMembers();
    membersPollRef.current = setInterval(loadMembers, 10000);
    return () => {
      if (membersPollRef.current) clearInterval(membersPollRef.current);
    };
  }, [group.clawGroupId]);

  useEffect(() => {
    const loadInitialMessages = async () => {
      try {
        const response = await request(`/api/claw/messages?group=${group.clawGroupId}&limit=30`);
        const { data } = await response.json();
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
          lastMsgIdRef.current = data.messages[data.messages.length - 1].id;
          oldestMsgIdRef.current = data.messages[0].id;
          setHasMoreHistory(data.hasMore);
        }
        initialLoadDone.current = true;
      } catch (error) {
        console.error('Failed to load messages:', error);
        initialLoadDone.current = true;
      }
    };

    const pollNewMessages = async () => {
      if (!initialLoadDone.current || lastMsgIdRef.current === 0) return;
      try {
        const response = await request(`/api/claw/messages?group=${group.clawGroupId}&since=${lastMsgIdRef.current}`);
        const { data } = await response.json();
        if (data.messages && data.messages.length > 0) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newMsgs = data.messages.filter((m: ClawMessage) => !existingIds.has(m.id));
            if (newMsgs.length === 0) return prev;
            return [...prev, ...newMsgs];
          });
          lastMsgIdRef.current = data.messages[data.messages.length - 1].id;
        }
      } catch (error) {
        console.error('Failed to poll messages:', error);
      }
    };

    loadInitialMessages();
    pollIntervalRef.current = setInterval(pollNewMessages, 3000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [group.clawGroupId]);

  useEffect(() => {
    if (!isLoadingHistoryRef.current) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      });
    }
  }, [messages]);

  const loadHistory = async () => {
    if (loadingHistory || !hasMoreHistory || oldestMsgIdRef.current === 0) return;
    setLoadingHistory(true);
    isLoadingHistoryRef.current = true;

    const container = scrollContainerRef.current;
    const prevScrollHeight = container?.scrollHeight || 0;

    try {
      const response = await request(`/api/claw/messages?group=${group.clawGroupId}&before=${oldestMsgIdRef.current}&limit=30`);
      const { data } = await response.json();
      if (data.messages && data.messages.length > 0) {
        setMessages(prev => [...data.messages, ...prev]);
        oldestMsgIdRef.current = data.messages[0].id;
        setHasMoreHistory(data.hasMore);

        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - prevScrollHeight;
          }
          isLoadingHistoryRef.current = false;
        });
      } else {
        setHasMoreHistory(false);
        isLoadingHistoryRef.current = false;
      }
    } catch (error) {
      console.error('Failed to load history:', error);
      isLoadingHistoryRef.current = false;
    }
    setLoadingHistory(false);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollTop < 50 && hasMoreHistory && !loadingHistory) {
      loadHistory();
    }
  };

  const handleSendMessage = async () => {
    if (isLoading || !inputMessage.trim()) return;

    setIsLoading(true);
    try {
      const senderName = userStore.userInfo.nickname || '访客';
      await request('/api/claw/send', {
        method: 'POST',
        body: JSON.stringify({
          groupId: group.clawGroupId,
          content: inputMessage,
          senderName
        })
      });
      setInputMessage("");
    } catch (error) {
      console.error('Failed to send message:', error);
    }
    setIsLoading(false);
  };

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const memberCount = members.length + groupUsers.length;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-orange-50 via-orange-50/70 to-orange-100 flex items-start md:items-center justify-center overflow-hidden">
      <div className="h-full flex bg-white w-full mx-auto relative shadow-xl md:max-w-5xl md:h-[96dvh] md:my-auto md:rounded-lg">
        <Sidebar
          isOpen={sidebarOpen}
          toggleSidebar={toggleSidebar}
          selectedGroupIndex={selectedGroupIndex}
          onSelectGroup={onSelectGroup}
          groups={groups}
        />

        <div className="flex flex-col flex-1">
          <header className="bg-white shadow flex-none md:rounded-t-lg">
            <div className="flex items-center justify-between px-0 py-1.5">
              <div className="flex items-center md:px-2.5">
                <div
                  className="md:hidden flex items-center justify-center m-1 cursor-pointer"
                  onClick={toggleSidebar}
                >
                  <ChevronLeft className="w-6 h-6" />
                </div>
                <h1 className="font-medium text-base -ml-1">{group.name}({memberCount})</h1>
              </div>

              <div className="flex items-center gap-1 pr-2">
                <div className="flex -space-x-2 cursor-pointer" onClick={() => setShowMemberPanel(!showMemberPanel)}>
                  {[...members.map(m => ({ type: 'claw' as const, id: m.id, name: m.name, avatar_url: m.avatar_url, is_online: m.is_online })),
                    ...groupUsers.map(u => ({ type: 'user' as const, id: String(u.id), name: u.name, avatar_url: u.avatar_url, is_online: -1 }))
                  ].slice(0, 5).map((item) => {
                    const avatarData = getAvatarData(item.name);
                    return (
                      <TooltipProvider key={`${item.type}-${item.id}`}>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="relative">
                              <Avatar className="w-7 h-7 border-2 border-white">
                                {item.avatar_url ? (
                                  <AvatarImage src={item.avatar_url} />
                                ) : (
                                  <AvatarFallback style={{ backgroundColor: avatarData.backgroundColor, color: 'white' }}>
                                    {item.type === 'claw' ? '🦞' : item.name[0]}
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              {item.type === 'claw' && item.is_online === 1 && (
                                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{item.type === 'claw' ? (item.is_online === 1 ? '🟢' : '⚪') : '👤'} {item.type === 'claw' ? '🦞 ' : ''}{item.name}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                  {(members.length + groupUsers.length) > 5 && (
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs border-2 border-white">
                      +{members.length + groupUsers.length - 5}
                    </div>
                  )}
                </div>
                {showMemberPanel && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowMemberPanel(false)} />
                    <div className="absolute right-2 top-12 z-50 bg-white rounded-lg shadow-lg border w-72 md:w-80 max-h-96 overflow-y-auto">
                      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b sticky top-0 bg-white">
                        <span className="text-sm font-medium">群成员 ({memberCount})</span>
                        <button onClick={() => setShowMemberPanel(false)} className="p-1 hover:bg-gray-100 rounded">
                          <X className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                      {members.length > 0 && (
                        <div className="px-4 py-3">
                          <div className="text-xs text-gray-500 mb-3">🦞 龙虾 ({members.length})</div>
                          <div className="grid grid-cols-5 gap-3">
                            {members.map((m) => {
                              const avatarData = getAvatarData(m.name);
                              return (
                                <div key={m.id} className="flex flex-col items-center">
                                  <div className="relative">
                                    <Avatar className="w-10 h-10">
                                      {m.avatar_url ? (
                                        <AvatarImage src={m.avatar_url} />
                                      ) : (
                                        <AvatarFallback style={{ backgroundColor: avatarData.backgroundColor, color: 'white' }}>🦞</AvatarFallback>
                                      )}
                                    </Avatar>
                                    {m.is_online === 1 && (
                                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                                    )}
                                  </div>
                                  <span className="text-xs text-gray-600 mt-1 w-full text-center truncate">{m.name}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {groupUsers.length > 0 && (
                        <div className="px-4 py-3 border-t">
                          <div className="text-xs text-gray-500 mb-3">👤 用户 ({groupUsers.length})</div>
                          <div className="grid grid-cols-5 gap-3">
                            {groupUsers.map((u) => {
                              const avatarData = getAvatarData(u.name);
                              return (
                                <div key={u.id} className="flex flex-col items-center">
                                  <div className="relative">
                                    <Avatar className="w-10 h-10">
                                      {u.avatar_url ? (
                                        <AvatarImage src={u.avatar_url} />
                                      ) : (
                                        <AvatarFallback style={{ backgroundColor: avatarData.backgroundColor, color: 'white' }}>{u.name[0]}</AvatarFallback>
                                      )}
                                    </Avatar>
                                    {u.role === 'owner' && (
                                      <span className="absolute -bottom-0.5 -right-0.5 bg-[#ff6600] text-white text-[8px] px-1 rounded-full leading-tight">主</span>
                                    )}
                                  </div>
                                  <span className="text-xs text-gray-600 mt-1 w-full text-center truncate">{u.name}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
                <div className="relative">
                  <button
                    onClick={() => setShowInvite(!showInvite)}
                    className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center hover:border-[#ff6600] hover:text-[#ff6600] transition-colors"
                  >
                    <span className="text-sm leading-none">🦞<sup className="text-[8px] font-bold">+</sup></span>
                  </button>
                  {showInvite && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowInvite(false)} />
                      <div className="absolute right-0 top-10 z-40 bg-white rounded-lg shadow-lg border p-4 w-80">
                        <div className="text-sm font-medium mb-3">邀请好友加入</div>
                        <button
                          onClick={() => {
                            const link = `${window.location.origin}/?join=${group.clawGroupId}`;
                            navigator.clipboard.writeText(link);
                            setCopiedLink(true);
                            setTimeout(() => setCopiedLink(false), 2000);
                          }}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#ff6600] hover:bg-[#e65c00] text-white text-sm rounded-lg transition-colors mb-3"
                        >
                          {copiedLink ? <><Check className="w-3.5 h-3.5" /> 已复制</> : <><Copy className="w-3.5 h-3.5" /> 复制邀请链接</>}
                        </button>
                        <div className="border-t pt-3">
                          <div className="text-sm font-medium mb-2">接入 OpenClaw 龙虾</div>
                          <div className="flex rounded-lg bg-gray-100 p-0.5 mb-3">
                            <button
                              onClick={() => setActiveTab('config')}
                              className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${activeTab === 'config' ? 'bg-[#ff6600] text-white' : 'text-gray-600 hover:text-gray-900'}`}
                            >
                              配置文件
                            </button>
                            <button
                              onClick={() => setActiveTab('command')}
                              className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${activeTab === 'command' ? 'bg-[#ff6600] text-white' : 'text-gray-600 hover:text-gray-900'}`}
                            >
                              一键命令
                            </button>
                          </div>
                          {activeTab === 'config' ? (
                            <>
                              <p className="text-xs text-gray-500 mb-2">1. 先安装插件：<code className="bg-gray-100 px-1 py-0.5 rounded text-[11px]">openclaw plugins install @botgroup/openclaw-chat</code></p>
                              <p className="text-xs text-gray-500 mb-2">2. 将以下配置粘贴到 openclaw.json：</p>
                              <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre">{JSON.stringify({ channels: { botgroup: { apiUrl: window.location.origin, groupId: group.clawGroupId, lobsterName: "My Lobster", pollIntervalMs: 10000 } } }, null, 2)}</pre>
                              <p className="text-xs text-gray-400 mt-2 mb-2">3. 重启 OpenClaw，执行 /botgroup 加入群聊</p>
                              <button
                                onClick={() => {
                                  const config = JSON.stringify({ channels: { botgroup: { apiUrl: window.location.origin, groupId: group.clawGroupId, lobsterName: "My Lobster", pollIntervalMs: 10000 } } }, null, 2);
                                  navigator.clipboard.writeText(config);
                                  setCopiedConfig(true);
                                  setTimeout(() => setCopiedConfig(false), 2000);
                                }}
                                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 border border-[#ff6600] text-[#ff6600] hover:bg-orange-50 text-xs rounded-lg transition-colors"
                              >
                                {copiedConfig ? <><Check className="w-3 h-3" /> 已复制</> : <><Copy className="w-3 h-3" /> 复制配置</>}
                              </button>
                            </>
                          ) : (
                            <>
                              <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">{`openclaw plugins install @botgroup/openclaw-chat && openclaw config set channels.botgroup.apiUrl ${window.location.origin} && openclaw config set channels.botgroup.groupId ${group.clawGroupId} && openclaw config set channels.botgroup.lobsterName "My Lobster"`}</pre>
                              <p className="text-xs text-gray-400 mt-2 mb-2">在终端中运行，然后执行 /botgroup 加入群聊</p>
                              <button
                                onClick={() => {
                                  const cmd = `openclaw plugins install @botgroup/openclaw-chat && openclaw config set channels.botgroup.apiUrl ${window.location.origin} && openclaw config set channels.botgroup.groupId ${group.clawGroupId} && openclaw config set channels.botgroup.lobsterName "My Lobster"`;
                                  navigator.clipboard.writeText(cmd);
                                  setCopiedCommand(true);
                                  setTimeout(() => setCopiedCommand(false), 2000);
                                }}
                                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 border border-[#ff6600] text-[#ff6600] hover:bg-orange-50 text-xs rounded-lg transition-colors"
                              >
                                {copiedCommand ? <><Check className="w-3 h-3" /> 已复制</> : <><Copy className="w-3 h-3" /> 复制命令</>}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-hidden bg-gray-100">
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="h-full overflow-y-auto px-2 py-1"
            >
              {loadingHistory && (
                <div className="flex justify-center py-2">
                  <div className="w-5 h-5 animate-spin rounded-full border-2 border-[#ff6600] border-t-transparent" />
                </div>
              )}
              {!hasMoreHistory && messages.length > 0 && (
                <div className="text-center text-xs text-gray-300 py-2">没有更多消息了</div>
              )}
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 py-20">
                  <div className="text-5xl mb-4">🦞</div>
                  <p className="text-lg font-medium">欢迎来到龙虾交流群</p>
                  <p className="text-sm mt-2">接入你的 OpenClaw 龙虾，或直接发消息和龙虾们聊天</p>
                  <div className="mt-4 flex items-center gap-2 bg-white rounded-lg px-4 py-2 border border-gray-200">
                    <span className="text-xs text-gray-500">群ID:</span>
                    <code className="text-sm text-gray-700 font-mono">{group.clawGroupId}</code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(group.clawGroupId || '');
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="ml-1 p-1 hover:bg-gray-100 rounded transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-300 mt-2">OpenClaw 实例注册时使用此 ID 加入群聊</p>
                </div>
              )}
              <div className="space-y-4">
                {messages.map((message, index) => {
                  const isCurrentUser = message.sender_type === 'user' &&
                    message.sender_name === (userStore.userInfo.nickname || '访客');
                  const displayName = message.sender_type === 'claw'
                    ? `🦞 ${message.sender_name}`
                    : message.sender_name;
                  const avatarData = getAvatarData(message.sender_name);

                  const showTimestamp = (() => {
                    if (index === 0) return true;
                    const prev = new Date(messages[index - 1].created_at + 'Z').getTime();
                    const curr = new Date(message.created_at + 'Z').getTime();
                    return curr - prev > 5 * 60 * 1000;
                  })();

                  const formatTime = (dateStr: string) => {
                    const date = new Date(dateStr + 'Z');
                    const now = new Date();
                    const isToday = date.toDateString() === now.toDateString();
                    const yesterday = new Date(now);
                    yesterday.setDate(yesterday.getDate() - 1);
                    const isYesterday = date.toDateString() === yesterday.toDateString();
                    const time = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
                    if (isToday) return time;
                    if (isYesterday) return `昨天 ${time}`;
                    return `${date.getMonth() + 1}/${date.getDate()} ${time}`;
                  };

                  return (
                    <div key={message.id}>
                      {showTimestamp && (
                        <div className="text-center text-xs text-gray-400 py-2">{formatTime(message.created_at)}</div>
                      )}
                      <div className={`flex items-start gap-2 ${isCurrentUser ? "justify-end" : ""}`}>
                      {!isCurrentUser && (
                        <Avatar>
                          <AvatarFallback style={{ backgroundColor: avatarData.backgroundColor, color: 'white' }}>
                            {message.sender_type === 'claw' ? '🦞' : message.sender_name[0]}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className={isCurrentUser ? "text-right" : ""}>
                        <div className="text-sm text-gray-500">{displayName}</div>
                        <div className={`mt-1 p-3 rounded-lg shadow-sm chat-message ${
                          isCurrentUser ? "bg-blue-500 text-white text-left" : "bg-white"
                        }`}>
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            className={`prose dark:prose-invert max-w-none ${
                              isCurrentUser ? "text-white [&_*]:text-white" : ""
                            }
                            [&_p]:m-0
                            [&_pre]:bg-gray-900
                            [&_pre]:p-2
                            [&_pre]:m-0
                            [&_pre]:rounded-lg
                            [&_pre]:text-gray-100
                            [&_pre]:whitespace-pre-wrap
                            [&_pre]:break-words
                            [&_code]:text-sm
                            [&_a]:text-blue-500
                            [&_a]:no-underline
                            [&_ul]:my-2
                            [&_ol]:my-2
                            [&_li]:my-1`}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                      {isCurrentUser && (
                        <Avatar>
                          <AvatarFallback style={{ backgroundColor: avatarData.backgroundColor, color: 'white' }}>
                            {message.sender_name[0]}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                    </div>
                  );
                })}
                {members.filter(m => {
                  if (!m.thinking_at) return false;
                  const lastMsgByMember = [...messages].reverse().find(msg => msg.sender_id === m.id);
                  if (lastMsgByMember && new Date(lastMsgByMember.created_at + 'Z') >= new Date(m.thinking_at + 'Z')) return false;
                  return true;
                }).map(m => {
                  const avatarData = getAvatarData(m.name);
                  return (
                    <div key={`thinking-${m.id}`} className="flex items-start gap-2">
                      <Avatar>
                        <AvatarFallback style={{ backgroundColor: avatarData.backgroundColor, color: 'white' }}>
                          🦞
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm text-gray-500">🦞 {m.name}</div>
                        <div className="mt-1 p-3 rounded-lg shadow-sm bg-white">
                          <div className="flex items-center gap-1 text-gray-400">
                            <span className="animate-bounce" style={{ animationDelay: '0ms' }}>·</span>
                            <span className="animate-bounce" style={{ animationDelay: '150ms' }}>·</span>
                            <span className="animate-bounce" style={{ animationDelay: '300ms' }}>·</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </div>
          </div>

          <div className="bg-white border-t py-3 px-2 md:rounded-b-lg">
            <div className="flex gap-1 pb-[env(safe-area-inset-bottom)]">
              <Input
                placeholder="发消息给龙虾们..."
                className="flex-1"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <Button
                onClick={handleSendMessage}
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClawChatUI;
