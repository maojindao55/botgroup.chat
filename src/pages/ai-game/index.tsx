import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Bot, Check, Copy, Eye, MessageSquare, Play, Send, Share2, Users, Vote } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { aiGameGlobalRules, aiGameModes } from '@/config/aiGame';
import { request } from '@/utils/request';
import { getAvatarData } from '@/utils/avatar';
import { useIsMobile } from '@/hooks/use-mobile';
import type { CurrentPlayerSecret, GameMessage, GamePlayer, GameResult, GameRoomData } from './types';

const playerStorageKey = (roomId: string) => `ai-game-player:${roomId}`;

function toUtcDate(date?: string | null) {
  if (!date) return null;
  return new Date(date.endsWith('Z') ? date : `${date}Z`);
}

function formatPercent(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return '0%';
  return `${Math.round(Number(value) * 100)}%`;
}

function PlayerAvatar({ player, revealed }: { player: GamePlayer; revealed?: boolean }) {
  const avatar = getAvatarData(player.display_name);
  const label = revealed && player.secret_role === 'ai' ? 'AI' : player.display_name[0];
  return (
    <Avatar className="w-9 h-9">
      <AvatarFallback style={{ backgroundColor: avatar.backgroundColor, color: 'white' }}>
        {label}
      </AvatarFallback>
    </Avatar>
  );
}

function parseUndercoverMeta(raw?: string | null) {
  if (!raw?.startsWith('undercover|')) return null;
  const parts = Object.fromEntries(raw.split('|').slice(1).map((part) => {
    const idx = part.indexOf('=');
    return idx >= 0 ? [part.slice(0, idx), part.slice(idx + 1)] : [part, ''];
  }));
  return {
    role: parts.role,
    word: parts.word,
    civilianWord: parts.civilian,
    undercoverWord: parts.undercover,
  };
}

function RuleList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 text-sm text-muted-foreground">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#ff6600]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function AiGameHome() {
  const navigate = useNavigate();
  const [mode, setMode] = useState(aiGameModes[0].id);
  const [name, setName] = useState(localStorage.getItem('ai-game-name') || '');
  const [roomId, setRoomId] = useState('');
  const [creating, setCreating] = useState(false);

  const [joining, setJoining] = useState(false);

  const selectedMode = aiGameModes.find(item => item.id === mode) || aiGameModes[0];

  const createRoom = async () => {
    setCreating(true);
    try {
      const roomRes = await request('/api/ai-game/rooms', {
        method: 'POST',
        body: JSON.stringify({
          mode,
          maxPlayers: selectedMode.maxPlayers,
          aiCount: selectedMode.aiCount,
          durationSeconds: selectedMode.durationSeconds,
        }),
      });
      const roomData = await roomRes.json();
      const newRoomId = roomData.data.roomId;
      const joinRes = await request('/api/ai-game/join', {
        method: 'POST',
        body: JSON.stringify({ roomId: newRoomId, displayName: name || '玩家1' }),
      });
      const joinData = await joinRes.json();
      localStorage.setItem(playerStorageKey(newRoomId), joinData.data.playerId);
      localStorage.setItem('ai-game-name', name || '玩家1');
      navigate(`/ai-game/${newRoomId}`);
    } catch (error: any) {
      toast.error(error.message || '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const joinRoom = async () => {
    const id = roomId.trim();
    if (!id) return;
    setJoining(true);
    try {
      const res = await request(`/api/ai-game/rooms?id=${id}`);
      const data = await res.json();
      const targetRoom = data.data?.room;
      if (!targetRoom) {
        toast.error('房间不存在');
        return;
      }
      if (targetRoom.status === 'revealed' || targetRoom.status === 'archived') {
        toast.error('该房间已结束');
        return;
      }
      const players = data.data?.players || [];
      const humanCount = players.filter((p: any) => p.player_type !== 'observer').length;
      if (targetRoom.status !== 'waiting' && humanCount >= targetRoom.max_players) {
        toast.error('房间已满');
        return;
      }
      if (targetRoom.status === 'waiting') {
        toast.success(`房间「${targetRoom.title}」等待中 (${humanCount}/${targetRoom.max_players})`);
      } else {
        toast.info(`房间「${targetRoom.title}」进行中，将作为旁观者加入`);
      }
      navigate(`/ai-game/${id}`);
    } catch (error: any) {
      toast.error(error.message || '房间查询失败');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="fixed inset-0 overflow-y-auto bg-background">
      <div className="mx-auto flex min-h-full max-w-5xl flex-col px-4 py-6 md:py-10">
        <div className="mb-6 flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate('/')}>返回群聊</Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Bot className="h-4 w-4" />
            真人 AI 混聊局
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-lg border bg-card p-5 shadow-sm">
            <div className="mb-5">
              <h1 className="text-2xl font-semibold tracking-normal">谁是 AI？</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                和一群“玩家”聊天，里面混着 AI。聊完投票，看看你能不能识破它们。
              </p>
            </div>

            <div className="grid gap-3">
              {aiGameModes.map(item => (
                <button
                  key={item.id}
                  onClick={() => setMode(item.id)}
                  className={`rounded-lg border p-4 text-left transition-colors ${mode === item.id ? 'border-[#ff6600] bg-orange-50 dark:bg-orange-950/20' : 'bg-background hover:bg-accent'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-muted-foreground">{item.maxPlayers - item.aiCount} 真人 + {item.aiCount} AI</div>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">{item.description}</div>
                  <div className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                    <div className="font-medium text-foreground/80">目标</div>
                    <div className="mt-1">{item.goal}</div>
                    <div className="mt-2 font-medium text-foreground/80">胜负</div>
                    <div className="mt-1">{item.winCondition}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Play className="h-4 w-4 text-[#ff6600]" />
              <h2 className="font-medium">快速开局</h2>
            </div>
            <div className="space-y-3">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={16}
                placeholder="你的昵称"
              />
              <Button onClick={createRoom} disabled={creating} className="w-full bg-[#ff6600] text-white hover:bg-[#e65c00]">
                {creating ? '创建中...' : '创建并加入'}
              </Button>
            </div>

            <div className="my-5 border-t" />

            <div className="mb-4 flex items-center gap-2">
              <Users className="h-4 w-4 text-[#ff6600]" />
              <h2 className="font-medium">加入已有房间</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Input value={roomId} onChange={(event) => setRoomId(event.target.value)} placeholder="game-xxxx" className="flex-1 min-w-0" />
              <Button variant="outline" onClick={joinRoom} disabled={joining}>{joining ? '查询中...' : '加入'}</Button>
            </div>

            <div className="mt-5 rounded-lg bg-muted p-3">
              <div className="mb-2 text-sm font-medium">通用规则</div>
              <RuleList items={aiGameGlobalRules} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function AiGameRoom() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState<GameRoomData | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [result, setResult] = useState<GameResult | null>(null);
  const [currentPlayerSecret, setCurrentPlayerSecret] = useState<CurrentPlayerSecret | null>(null);
  const [messages, setMessages] = useState<GameMessage[]>([]);
  const [name, setName] = useState(localStorage.getItem('ai-game-name') || '');
  const [input, setInput] = useState('');
  const [playerId, setPlayerId] = useState(() => localStorage.getItem(playerStorageKey(roomId)) || '');
  const [selectedVote, setSelectedVote] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'chat' | 'info'>('chat');
  const [unreadCount, setUnreadCount] = useState(0);
  const [confirmAction, setConfirmAction] = useState<'vote' | 'reveal' | null>(null);
  const lastMessageIdRef = useRef(0);
  const lastSeenMessageCountRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const currentPlayer = useMemo(() => players.find(player => player.id === playerId), [players, playerId]);
  const candidatePlayers = useMemo(() => players.filter(player => player.player_type !== 'observer'), [players]);
  const activeCandidatePlayers = useMemo(() => candidatePlayers.filter(player => !player.eliminated_at), [candidatePlayers]);
  const revealed = room?.status === 'revealed' || room?.status === 'archived';
  const startedAt = toUtcDate(room?.started_at);
  const endsAt = startedAt && room ? new Date(startedAt.getTime() + room.duration_seconds * 1000) : null;
  const [now, setNow] = useState(Date.now());
  const secondsLeft = endsAt ? Math.max(0, Math.ceil((endsAt.getTime() - now) / 1000)) : room?.duration_seconds || 0;
  const effectiveStatus = room?.status === 'playing' && secondsLeft <= 0 && room.mode !== 'jury' && room.mode !== 'undercover' ? 'voting' : room?.status;

  const loadRoom = useCallback(async () => {
    if (!roomId) return;
    const res = await request(`/api/ai-game/rooms?id=${roomId}${playerId ? `&player=${playerId}` : ''}`);
    const data = await res.json();
    setRoom(data.data.room);
    setPlayers(data.data.players || []);
    setResult(data.data.result || null);
    setCurrentPlayerSecret(data.data.currentPlayerSecret || null);
  }, [roomId, playerId]);

  const loadMessages = useCallback(async () => {
    if (!roomId) return;
    const res = await request(`/api/ai-game/messages?room=${roomId}&since=${lastMessageIdRef.current}${playerId ? `&player=${playerId}` : ''}`);
    const data = await res.json();
    const newMessages = data.data.messages || [];
    if (newMessages.length > 0) {
      lastMessageIdRef.current = newMessages[newMessages.length - 1].id;
      setMessages(prev => {
        const ids = new Set(prev.map(msg => msg.id));
        return [...prev, ...newMessages.filter((msg: GameMessage) => !ids.has(msg.id))];
      });
    }
  }, [roomId, playerId]);

  useEffect(() => {
    loadRoom().catch((error) => toast.error(error.message || '房间加载失败'));
    lastMessageIdRef.current = 0;
    setMessages([]);
  }, [loadRoom, roomId]);

  useEffect(() => {
    loadMessages().catch(() => {});
    const interval = setInterval(() => {
      loadRoom().catch(() => {});
      loadMessages().catch(() => {});
    }, 2500);
    return () => clearInterval(interval);
  }, [loadMessages, loadRoom]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset unread when switching to chat panel
  useEffect(() => {
    if (mobilePanel === 'chat') {
      setUnreadCount(0);
      lastSeenMessageCountRef.current = messages.length;
    }
  }, [mobilePanel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track new messages while on info panel (mobile)
  useEffect(() => {
    if (isMobile && mobilePanel === 'info' && messages.length > lastSeenMessageCountRef.current) {
      setUnreadCount(messages.length - lastSeenMessageCountRef.current);
    }
    if (mobilePanel === 'chat') {
      lastSeenMessageCountRef.current = messages.length;
    }
  }, [messages.length, mobilePanel, isMobile]);

  // Auto-switch to chat panel when voting starts on mobile
  useEffect(() => {
    if (isMobile && effectiveStatus === 'voting' && mobilePanel !== 'chat') {
      setMobilePanel('chat');
    }
  }, [effectiveStatus, isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

  const join = async () => {
    if (!roomId) return;
    setBusy(true);
    try {
      const res = await request('/api/ai-game/join', {
        method: 'POST',
        body: JSON.stringify({ roomId, displayName: name || '玩家' }),
      });
      const data = await res.json();
      localStorage.setItem(playerStorageKey(roomId), data.data.playerId);
      localStorage.setItem('ai-game-name', name || '玩家');
      setPlayerId(data.data.playerId);
      await loadRoom();
    } catch (error: any) {
      toast.error(error.message || '加入失败');
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    setBusy(true);
    try {
      await request('/api/ai-game/start', { method: 'POST', body: JSON.stringify({ roomId }) });
      await loadRoom();
      await loadMessages();
    } catch (error: any) {
      toast.error(error.message || '开始失败');
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!input.trim() || !currentPlayer || effectiveStatus !== 'playing') return;
    const content = input;
    setInput('');
    try {
      await request('/api/ai-game/send', {
        method: 'POST',
        body: JSON.stringify({ roomId, playerId: currentPlayer.id, content }),
      });
      await loadMessages();
      request('/api/ai-game/ai-turn', { method: 'POST', body: JSON.stringify({ roomId }) })
        .then(() => loadMessages())
        .catch((error) => toast.error(error.message || 'AI 暂时没接上话'));
    } catch (error: any) {
      setInput(content);
      toast.error(error.message || '发送失败');
    }
  };

  const vote = async () => {
    if (!selectedVote || !currentPlayer) return;
    setBusy(true);
    try {
      await request('/api/ai-game/vote', {
        method: 'POST',
        body: JSON.stringify({ roomId, voterPlayerId: currentPlayer.id, targetPlayerId: selectedVote }),
      });
      toast.success('投票已提交');
      setSelectedVote('');
      await loadRoom();
      await loadMessages();
    } catch (error: any) {
      toast.error(error.message || '投票失败');
    } finally {
      setBusy(false);
    }
  };

  const reveal = async () => {
    setBusy(true);
    try {
      await request('/api/ai-game/reveal', { method: 'POST', body: JSON.stringify({ roomId }) });
      await loadRoom();
    } catch (error: any) {
      toast.error(error.message || '揭晓失败');
    } finally {
      setBusy(false);
    }
  };

  const copyShare = async () => {
    const text = `${result?.share_text || '我刚玩了一局“谁是 AI”，来猜猜谁是真人。'} ${window.location.href}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (!room) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#ff6600] border-t-transparent" />
      </div>
    );
  }

  const modeRules = aiGameModes.find(item => item.id === room.mode) || aiGameModes[0];
  const isObserver = currentPlayer?.player_type === 'observer';
  const isJuryMode = room.mode === 'jury';
  const isUndercoverMode = room.mode === 'undercover';
  const currentPlayerEliminated = !!currentPlayer?.eliminated_at;
  const canVote = currentPlayer && !currentPlayerEliminated && (effectiveStatus === 'playing' || effectiveStatus === 'voting') && !revealed;
  const canSpeak = !!currentPlayer && !currentPlayerEliminated && effectiveStatus === 'playing';
  const canGuess = canVote && !isJuryMode;
  const statusText = (() => {
    if (revealed) return isJuryMode ? '已宣判' : '已揭晓';
    if (effectiveStatus === 'waiting') return '等待开局';
    if (isJuryMode && effectiveStatus === 'playing') return secondsLeft > 0 ? `庭审剩余 ${secondsLeft}s` : '可请求宣判';
    if (isUndercoverMode && effectiveStatus === 'playing') return '进行中';
    if (effectiveStatus === 'playing') return `剩余 ${secondsLeft}s`;
    if (effectiveStatus === 'voting') return '投票中';
    return '进行中';
  })();

  return (
    <div className="fixed inset-0 bg-background">
      <div className="flex h-full flex-col">
        <header className="flex flex-none items-center justify-between border-b bg-card px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/ai-game')}>返回</Button>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{room.title}</div>
              <div className="text-xs text-muted-foreground">
                {statusText}
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={copyShare}>
            {copied ? <Check className="mr-1 h-4 w-4" /> : <Share2 className="mr-1 h-4 w-4" />}
            分享
          </Button>
        </header>

        {effectiveStatus === 'playing' && startedAt && room && (
          <div className="h-1 w-full bg-muted">
            <div
              className="h-full transition-all duration-1000 ease-linear"
              style={{
                width: `${Math.max(0, (secondsLeft / room.duration_seconds) * 100)}%`,
                backgroundColor: secondsLeft > room.duration_seconds * 0.5
                  ? '#22c55e'
                  : secondsLeft > room.duration_seconds * 0.2
                    ? '#f59e0b'
                    : '#ef4444',
              }}
            />
          </div>
        )}

        <main className="grid flex-1 overflow-hidden md:grid-cols-[1fr_320px]">
          <section className={`flex min-h-0 flex-col bg-muted ${isMobile && mobilePanel === 'info' ? 'hidden' : ''}`}>
            <div className="flex-1 overflow-y-auto px-3 py-3">
              <div className="mx-auto max-w-3xl space-y-3">
                {messages.length === 0 && (
                  <div className="flex h-56 flex-col items-center justify-center text-center text-muted-foreground">
                    <Eye className="mb-3 h-8 w-8" />
                    <div className="text-sm">开局后开始聊天，别太快暴露自己。</div>
                  </div>
                )}
                {messages.map(message => {
                  const mine = message.player_id === playerId;
                  const system = message.sender_type === 'system';
                  const avatar = getAvatarData(message.sender_name);
                  if (system) {
                    return <div key={message.id} className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300 text-center text-xs text-muted-foreground">{message.content}</div>;
                  }
                  return (
                    <div key={message.id} className={`animate-in fade-in-0 slide-in-from-bottom-2 duration-300 flex items-start gap-2 ${mine ? 'justify-end' : ''}`}>
                      {!mine && (
                        <Avatar className="h-9 w-9 flex-shrink-0">
                          <AvatarFallback style={{ backgroundColor: avatar.backgroundColor, color: 'white' }}>{message.sender_name[0]}</AvatarFallback>
                        </Avatar>
                      )}
                      <div className={`max-w-[78%] ${mine ? 'text-right' : ''}`}>
                        <div className="text-xs text-muted-foreground">{message.sender_name}</div>
                        <div className={`mt-1 rounded-lg px-3 py-2 text-sm shadow-sm ${mine ? 'bg-blue-500 text-left text-white' : 'bg-card'}`}>
                          {message.content}
                        </div>
                      </div>
                      {mine && (
                        <Avatar className="h-9 w-9 flex-shrink-0">
                          <AvatarFallback style={{ backgroundColor: avatar.backgroundColor, color: 'white' }}>{message.sender_name[0]}</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="border-t bg-card p-2 pb-2 md:pb-2" style={{ paddingBottom: isMobile ? 'calc(0.5rem + 3.5rem + env(safe-area-inset-bottom, 0px))' : undefined }}>
              {!currentPlayer && room.status === 'waiting' ? (
                <div className="mx-auto flex max-w-3xl gap-2">
                  <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={16} placeholder="你的昵称" />
                  <Button onClick={join} disabled={busy}>加入</Button>
                </div>
              ) : effectiveStatus === 'playing' ? (
                <div className="mx-auto flex max-w-3xl gap-2">
                  <Input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') send(); }}
                    placeholder={currentPlayerEliminated ? '你已出局，可以继续观看本局' : isUndercoverMode ? '描述你的词，别直接说出词语...' : isJuryMode ? '为自己辩护，或者反问证人...' : isObserver ? '向候选玩家提一个问题...' : currentPlayer ? '自然点，别像 AI...' : '你正在围观本局'}
                    disabled={!canSpeak}
                    maxLength={500}
                  />
                  <Button onClick={send} disabled={!canSpeak || !input.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="text-center text-sm text-muted-foreground">当前阶段不能发言</div>
              )}
            </div>
          </section>

          <aside className={`flex min-h-0 flex-col border-l bg-card ${isMobile && mobilePanel === 'chat' ? 'hidden' : ''}`}>
            <div className="border-b p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="font-medium">{isUndercoverMode ? '玩家列表' : isJuryMode ? '法庭成员' : isObserver ? '候选玩家' : '玩家席位'}</div>
                <div className="text-xs text-muted-foreground">{activeCandidatePlayers.length}/{room.max_players}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {candidatePlayers.map(player => (
                  <button
                    key={player.id}
                    onClick={() => setSelectedVote(player.id)}
                    disabled={!canGuess || player.id === currentPlayer?.id || player.player_type === 'observer' || !!player.eliminated_at}
                    className={`flex items-center gap-2 rounded-lg border p-2 text-left transition-colors ${selectedVote === player.id ? 'border-[#ff6600] bg-orange-50 dark:bg-orange-950/20' : 'hover:bg-accent'} ${player.id === currentPlayer?.id || player.eliminated_at ? 'opacity-70' : ''}`}
                  >
                    <PlayerAvatar player={player} revealed={revealed} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{player.display_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {isUndercoverMode && player.eliminated_at && !revealed
                          ? '已出局'
                          : isUndercoverMode && revealed
                            ? `${parseUndercoverMeta(player.ai_persona)?.role === 'undercover' ? '卧底' : '平民'}${player.eliminated_at ? ' · 已出局' : ''}`
                          : isJuryMode && !revealed ? (player.id === currentPlayer?.id ? '被告' : '法庭角色') : revealed ? (player.secret_role === 'ai' ? 'AI' : player.secret_role === 'observer' ? '观察者' : '真人') : player.id === currentPlayer?.id ? '你' : '身份未知'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {isUndercoverMode && !revealed && currentPlayerSecret?.word && (
                <div className="mb-3 rounded-lg border border-[#ff6600]/30 bg-orange-50 p-3 dark:bg-orange-950/20">
                  <div className="text-xs text-muted-foreground">你的词语</div>
                  <div className="mt-1 text-2xl font-semibold tracking-normal text-[#ff6600]">{currentPlayerSecret.word}</div>
                  <div className="mt-1 text-xs text-muted-foreground">描述时不能直接说出这个词。</div>
                </div>
              )}
              {room.status === 'waiting' && (
                <div className="space-y-3">
                  <div className="rounded-lg bg-muted p-3">
                    <div className="mb-2 text-sm font-medium">本局规则</div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>{modeRules.setup}</p>
                      <p>{modeRules.goal}</p>
                      <p>{modeRules.winCondition}</p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <div className="mb-2 text-sm font-medium">流程</div>
                    <RuleList items={modeRules.flow} />
                  </div>
                  <Button onClick={start} disabled={busy || players.length === 0} className="w-full bg-[#ff6600] text-white hover:bg-[#e65c00]">
                    <Play className="mr-2 h-4 w-4" />
                    开始游戏
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigator.clipboard.writeText(room.id).then(() => toast.success('房间 ID 已复制'))}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    复制房间 ID
                  </Button>
                </div>
              )}

              {effectiveStatus === 'playing' && (
                <div className="space-y-3">
                  <div className="rounded-lg bg-muted p-3">
                    <div className="mb-2 text-sm font-medium">当前目标</div>
                    <div className="text-sm text-muted-foreground">{modeRules.goal}</div>
                    <div className="mt-3 mb-2 text-sm font-medium">判断线索</div>
                    <RuleList items={isUndercoverMode ? [
                      '看谁的描述和大家不是同一个方向',
                      '追问模糊发言的人，让他补一个细节',
                      '卧底可以故意附和多数人，平民要找出这种顺风话',
                      '每轮投出一人后不公布身份，剩下的人继续聊',
                    ] : [
                      '是否能自然接住上下文',
                      '是否有真实但不过度编造的细节',
                      '是否总是回答得太完整、太礼貌',
                      '是否会回避追问或突然转移话题',
                    ]} />
                  </div>
                  {!isJuryMode && (
                  <Button variant="outline" onClick={() => setConfirmAction('vote')} disabled={!selectedVote || !currentPlayer || busy} className="w-full">
                    <Vote className="mr-2 h-4 w-4" />
                    {isUndercoverMode ? '提交投票' : '投给选中的玩家'}
                  </Button>
                  )}
                  <Button onClick={() => setConfirmAction('reveal')} disabled={busy} className="w-full">
                    {isUndercoverMode ? '揭晓身份' : isJuryMode ? '请求宣判' : '直接揭晓'}
                  </Button>
                </div>
              )}

              {effectiveStatus === 'voting' && !isJuryMode && (
                <div className="space-y-3">
                  <Button onClick={() => setConfirmAction('vote')} disabled={!selectedVote || !currentPlayer || busy} className="w-full bg-[#ff6600] text-white hover:bg-[#e65c00]">
                    提交投票
                  </Button>
                  <Button variant="outline" onClick={() => setConfirmAction('reveal')} disabled={busy} className="w-full">
                    揭晓身份
                  </Button>
                </div>
              )}

              {revealed && (
                <div className="space-y-3">
                  <div className="rounded-lg border bg-card p-3">
                    <div className="mb-2 text-sm font-medium">身份揭晓</div>
                    <div className="space-y-2">
                      {candidatePlayers.map(player => {
                        const avatar = getAvatarData(player.display_name);
                        const isMe = player.id === currentPlayer?.id;
                        const isUndercover = isUndercoverMode && parseUndercoverMeta(player.ai_persona)?.role === 'undercover';
                        const isAi = !isUndercoverMode && player.secret_role === 'ai';
                        const roleLabel = isUndercoverMode
                          ? (isUndercover ? '卧底' : '平民')
                          : (isAi ? 'AI' : '真人');
                        const isHighlight = isUndercover || isAi;
                        return (
                          <div key={player.id} className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarFallback style={{ backgroundColor: avatar.backgroundColor, color: 'white' }}>{player.display_name[0]}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0 text-sm truncate">{player.display_name}</div>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isHighlight ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'}`}>
                              {roleLabel}
                            </span>
                            {isMe && <span className="text-xs text-muted-foreground">(你)</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {!isJuryMode && !isUndercoverMode && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-muted p-3">
                        <div className="text-xs text-muted-foreground">识别率</div>
                        <div className="mt-1 text-lg font-semibold">{formatPercent(result?.human_accuracy)}</div>
                      </div>
                      <div className="rounded-lg bg-muted p-3">
                        <div className="text-xs text-muted-foreground">AI 逃脱率</div>
                        <div className="mt-1 text-lg font-semibold">{formatPercent(result?.ai_escape_rate)}</div>
                      </div>
                    </div>
                  )}
                  {isUndercoverMode && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-muted p-3">
                        <div className="text-xs text-muted-foreground">你的判断</div>
                        <div className="mt-1 text-lg font-semibold">{Number(result?.human_accuracy) === 1 ? '猜中' : '猜错'}</div>
                      </div>
                      <div className="rounded-lg bg-muted p-3">
                        <div className="text-xs text-muted-foreground">你的身份</div>
                        <div className="mt-1 text-lg font-semibold">{currentPlayerSecret?.role === 'undercover' ? '卧底' : '平民'}</div>
                      </div>
                    </div>
                  )}
                  <div className="rounded-lg bg-muted p-3 text-sm">
                    {result?.summary || (isJuryMode ? '本案已经宣判。' : '本局已经揭晓。')}
                  </div>
                  <Button onClick={copyShare} className="w-full">
                    {copied ? <Check className="mr-2 h-4 w-4" /> : <Share2 className="mr-2 h-4 w-4" />}
                    复制战绩
                  </Button>
                  <Button onClick={() => navigate('/ai-game')} className="w-full bg-[#ff6600] text-white hover:bg-[#e65c00]">
                    <Play className="mr-2 h-4 w-4" />
                    再来一局
                  </Button>
                </div>
              )}
            </div>
          </aside>
        </main>

        {isMobile && selectedVote && canGuess && mobilePanel === 'info' && (
          <div className="fixed left-0 right-0 z-40 border-t bg-card px-3 py-2 md:hidden" style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}>
            <div className="flex items-center gap-2">
              <div className="flex-1 text-sm">
                已选择：<span className="font-medium">{candidatePlayers.find(p => p.id === selectedVote)?.display_name}</span>
              </div>
              <Button size="sm" onClick={() => setConfirmAction('vote')} disabled={busy} className="bg-[#ff6600] text-white hover:bg-[#e65c00]">
                <Vote className="mr-1 h-3.5 w-3.5" />
                投票
              </Button>
            </div>
          </div>
        )}

        {isMobile && (
          <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t bg-card md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <button
              onClick={() => { setMobilePanel('chat'); setUnreadCount(0); }}
              className={`relative flex flex-1 items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${mobilePanel === 'chat' ? 'text-[#ff6600]' : 'text-muted-foreground'}`}
            >
              <MessageSquare className="h-4 w-4" />
              聊天
              {unreadCount > 0 && (
                <span className="absolute right-1/4 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setMobilePanel('info')}
              className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${mobilePanel === 'info' ? 'text-[#ff6600]' : 'text-muted-foreground'}`}
            >
              <Users className="h-4 w-4" />
              信息
            </button>
          </nav>
        )}
      </div>

      <Dialog open={confirmAction !== null} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirmAction === 'vote' ? '确认投票' : '确认揭晓'}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === 'vote'
                ? `确定要投给「${candidatePlayers.find(p => p.id === selectedVote)?.display_name || '该玩家'}」吗？投票后不可撤回。`
                : '揭晓后将公布所有玩家身份，本局结束。确定要揭晓吗？'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>取消</Button>
            <Button
              className="bg-[#ff6600] text-white hover:bg-[#e65c00]"
              onClick={async () => {
                const action = confirmAction;
                setConfirmAction(null);
                if (action === 'vote') {
                  await vote();
                } else if (action === 'reveal') {
                  await reveal();
                }
              }}
              disabled={busy}
            >
              {busy ? '处理中...' : '确认'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AiGamePage() {
  const { roomId } = useParams();
  return roomId ? <AiGameRoom /> : <AiGameHome />;
}
