import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Bot, Check, Copy, Download, Eye, Flag, Loader2, Lock, Play, Send, Share2, Star, Users, Vote, AlertCircle, Trophy } from 'lucide-react';
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
import { aiGameGlobalRules, aiGameModes, generateCampaignLevel, getCampaignWindow } from '@/config/aiGame';
import type { AiGameCampaignLevel } from '@/config/aiGame';
import { request } from '@/utils/request';
import { getAvatarData } from '@/utils/avatar';
import type { CurrentPlayerSecret, GameMessage, GamePlayer, GameResult, GameRoomData } from './types';
import { getPlayerRoleLabel, parseVoteResultMessage } from './voteMessage';
import { buildAiGameChallengeUrl, parseChallengeLevel } from './share';
import { createQrSvgDataUrl } from './qr';

const playerStorageKey = (roomId: string) => `ai-game-player:${roomId}`;
const roomLevelStorageKey = (roomId: string) => `ai-game-room-level:${roomId}`;
const campaignProgressKey = 'ai-game-campaign-progress';

interface CampaignProgress {
  highestUnlockedLevel: number;
  bestStars: Record<string, number>;
  clearedAt: Record<string, string>;
}

function normalizeCampaignProgress(raw: any): CampaignProgress {
  if (raw && typeof raw.highestUnlockedLevel === 'number' && raw.bestStars && raw.clearedAt) {
    return {
      highestUnlockedLevel: Math.max(1, Math.floor(raw.highestUnlockedLevel || 1)),
      bestStars: raw.bestStars || {},
      clearedAt: raw.clearedAt || {},
    };
  }

  const bestStars: Record<string, number> = {};
  const clearedAt: Record<string, string> = {};
  let highestCleared = 0;

  if (raw && typeof raw === 'object') {
    Object.entries(raw).forEach(([key, value]) => {
      const levelNumber = Number(key.replace(/^u/, ''));
      const item = value as { stars?: number; clearedAt?: string };
      if (!Number.isFinite(levelNumber) || levelNumber < 1 || !item?.stars) return;
      bestStars[String(levelNumber)] = Math.max(0, Math.min(3, Number(item.stars) || 0));
      if (item.clearedAt) clearedAt[String(levelNumber)] = item.clearedAt;
      highestCleared = Math.max(highestCleared, levelNumber);
    });
  }

  return {
    highestUnlockedLevel: Math.max(1, highestCleared + 1),
    bestStars,
    clearedAt,
  };
}

function loadCampaignProgress(): CampaignProgress {
  try {
    return normalizeCampaignProgress(JSON.parse(localStorage.getItem(campaignProgressKey) || '{}'));
  } catch {
    return normalizeCampaignProgress(null);
  }
}

function saveCampaignProgress(progress: CampaignProgress) {
  localStorage.setItem(campaignProgressKey, JSON.stringify(progress));
}

function toUtcDate(date?: string | null) {
  if (!date) return null;
  return new Date(date.endsWith('Z') ? date : `${date}Z`);
}

function formatPercent(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return '0%';
  return `${Math.round(Number(value) * 100)}%`;
}

function formatCountdown(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const restSeconds = safeSeconds % 60;
  return `${minutes}:${String(restSeconds).padStart(2, '0')}`;
}

function resultStars(result?: GameResult | null) {
  return Math.max(0, Math.min(3, Math.round(Number(result?.human_accuracy || 0) * 3)));
}

function extractUndercoverWordPair(summary?: string | null) {
  const match = summary?.match(/平民词是「(.+?)」，卧底词是「(.+?)」/);
  return match ? { civilianWord: match[1], undercoverWord: match[2] } : null;
}

function PlayerAvatar({ player, revealed, compact = false }: { player: GamePlayer; revealed?: boolean; compact?: boolean }) {
  const avatar = getAvatarData(player.display_name);
  const label = revealed && player.secret_role === 'ai' ? 'AI' : player.display_name[0];
  return (
    <Avatar className={compact ? 'h-7 w-7' : 'h-9 w-9'}>
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
          <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#c2410c]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function VoteRoleBadge({ label }: { label?: string | null }) {
  if (!label) return null;
  const highlight = label === '卧底' || label === 'AI';
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none ${highlight ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'}`}>
      {label}
    </span>
  );
}

function VoteRecord({
  voterName,
  targetName,
  voterRole,
  targetRole,
  targetEliminated,
}: {
  voterName: string;
  targetName: string;
  voterRole?: string | null;
  targetRole?: string | null;
  targetEliminated?: boolean;
}) {
  const voterAvatar = getAvatarData(voterName);
  const targetAvatar = getAvatarData(targetName);
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-xs">
      <Avatar className="h-5 w-5">
        <AvatarFallback style={{ backgroundColor: voterAvatar.backgroundColor, color: 'white', fontSize: 10 }}>{voterName[0]}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 truncate font-medium">{voterName}</span>
      <VoteRoleBadge label={voterRole} />
      <span className="text-muted-foreground">→</span>
      <Avatar className={`h-5 w-5 ${targetEliminated ? 'opacity-50 grayscale' : ''}`}>
        <AvatarFallback style={{ backgroundColor: targetAvatar.backgroundColor, color: 'white', fontSize: 10 }}>{targetName[0]}</AvatarFallback>
      </Avatar>
      <span className={`min-w-0 truncate font-medium ${targetEliminated ? 'line-through text-muted-foreground' : ''}`}>{targetName}</span>
      <VoteRoleBadge label={targetRole} />
      {targetEliminated && <span className="flex-none font-medium text-red-500">已出局</span>}
    </div>
  );
}

function EliminatedIdentityRecord({
  player,
  isUndercoverMode,
}: {
  player: GamePlayer;
  isUndercoverMode: boolean;
}) {
  const avatar = getAvatarData(player.display_name);
  const roleLabel = getPlayerRoleLabel({ player, isUndercoverMode });

  return (
    <div className="flex min-w-0 items-center gap-1.5 text-xs">
      <span className="flex-none rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium leading-none text-red-700 dark:bg-red-950/40 dark:text-red-400">已出局</span>
      <Avatar className="h-5 w-5 flex-none opacity-50 grayscale">
        <AvatarFallback style={{ backgroundColor: avatar.backgroundColor, color: 'white', fontSize: 10 }}>{player.display_name[0]}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 truncate font-medium text-muted-foreground line-through">{player.display_name}</span>
      <VoteRoleBadge label={roleLabel} />
    </div>
  );
}

function AiGameShareDialog({
  open,
  onOpenChange,
  room,
  result,
  campaignLevel,
  campaignStars,
  currentPlayerSecret,
  challengeUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: GameRoomData;
  result: GameResult | null;
  campaignLevel: AiGameCampaignLevel | null;
  campaignStars: number;
  currentPlayerSecret: CurrentPlayerSecret | null;
  challengeUrl: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const wordPair = extractUndercoverWordPair(result?.summary);
  const stars = resultStars(result);
  const guessedRight = stars > 0;
  const title = campaignLevel ? `卧底晋级赛 第 ${campaignLevel.levelNumber} 关` : room.title.replace(/\s*\[tier:[^\]]+\]/, '');
  const verdict = guessedRight ? '一票抓住破绽' : '这局被带偏了';
  const roleText = currentPlayerSecret?.role === 'undercover' ? '卧底' : currentPlayerSecret?.role ? '平民' : '玩家';
  const qrCodeUrl = useMemo(() => {
    try {
      return createQrSvgDataUrl(challengeUrl);
    } catch {
      return '';
    }
  }, [challengeUrl]);

  const copyChallengeLink = async () => {
    await navigator.clipboard.writeText(challengeUrl);
    toast.success('挑战链接已复制');
  };

  const savePoster = async () => {
    if (!cardRef.current) return;
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#fff7ed',
        scale: 2,
        useCORS: true,
      });
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 1));
      if (!blob) throw new Error('poster blob failed');

      if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && navigator.share && navigator.canShare?.({ files: [new File([blob], 'ai-game-result.png', { type: 'image/png' })] })) {
        await navigator.share({
          files: [new File([blob], 'ai-game-result.png', { type: 'image/png' })],
          title: title,
          text: result?.share_text || '我刚玩了一局谁是卧底',
        });
        return;
      }

      const pngUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = pngUrl;
      link.download = 'ai-game-result.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(pngUrl);
    } catch (error) {
      console.error('ai-game share poster failed:', error);
      toast.error('保存战绩卡失败');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>战绩卡</DialogTitle>
          <DialogDescription>保存战绩卡或复制挑战链接</DialogDescription>
        </DialogHeader>
        <div className="max-h-[80vh] overflow-y-auto p-3">
          <div ref={cardRef} className="overflow-hidden rounded-lg border border-orange-200 bg-orange-50 text-zinc-950 shadow-sm">
            <div className="bg-[#c2410c] px-5 py-4 text-white">
              <div className="text-xs opacity-80">谁是卧底 · 战绩卡</div>
              <div className="mt-1 text-xl font-semibold tracking-normal">{verdict}</div>
              <div className="mt-1 truncate text-sm opacity-90">{title}</div>
            </div>
            <div className="space-y-4 p-5">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-white p-2">
                  <div className="text-[11px] text-zinc-500">结果</div>
                  <div className="mt-1 text-sm font-semibold">{guessedRight ? '成功' : '失败'}</div>
                </div>
                <div className="rounded-md bg-white p-2">
                  <div className="text-[11px] text-zinc-500">身份</div>
                  <div className="mt-1 text-sm font-semibold">{roleText}</div>
                </div>
                <div className="rounded-md bg-white p-2">
                  <div className="text-[11px] text-zinc-500">星级</div>
                  <div className="mt-1 flex justify-center text-[#c2410c]">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <Star key={index} className={`h-4 w-4 ${index < campaignStars ? 'fill-current' : 'opacity-25'}`} />
                    ))}
                  </div>
                </div>
              </div>
              {wordPair && (
                <div className="rounded-md bg-white p-3">
                  <div className="text-xs text-zinc-500">本局词组</div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                    <span>平民词 <b>{wordPair.civilianWord}</b></span>
                    <span className="text-zinc-300">/</span>
                    <span>卧底词 <b>{wordPair.undercoverWord}</b></span>
                  </div>
                </div>
              )}
              <div className="rounded-md bg-white p-3 text-sm leading-6 text-zinc-700">
                {result?.share_text || '我刚玩了一局谁是卧底，来挑战同一关。'}
              </div>
              <div className="flex items-center gap-3 border-t border-orange-200 pt-3">
                {qrCodeUrl && (
                  <img
                    src={qrCodeUrl}
                    alt="挑战二维码"
                    className="h-20 w-20 flex-none rounded-md border border-orange-100 bg-white p-1"
                  />
                )}
                <div className="min-w-0 text-xs leading-5 text-zinc-500">
                  <div className="font-medium text-zinc-700">扫码挑战同一关</div>
                  <div className="mt-0.5 break-all">{challengeUrl}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={copyChallengeLink}>
              <Copy className="mr-2 h-4 w-4" />
              复制挑战链接
            </Button>
            <Button onClick={savePoster} className="bg-[#c2410c] text-white hover:bg-[#9a3412]">
              <Download className="mr-2 h-4 w-4" />
              保存图片
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface GameControlPanelProps {
  room: GameRoomData;
  modeRules: (typeof aiGameModes)[number];
  effectiveStatus: GameRoomData['status'];
  players: GamePlayer[];
  candidatePlayers: GamePlayer[];
  activeCandidatePlayers: GamePlayer[];
  currentPlayer?: GamePlayer;
  currentPlayerSecret: CurrentPlayerSecret | null;
  selectedVote: string;
  setSelectedVote: (value: string) => void;
  canGuess: boolean;
  canReveal: boolean;
  campaignTimedOut?: boolean;
  busy: boolean;
  revealed: boolean;
  isObserver: boolean;
  isJuryMode: boolean;
  isUndercoverMode: boolean;
  result: GameResult | null;
  copied: boolean;
  onStart: () => void;
  onCopyShare: () => void;
  onNewGame: () => void;
  onReplay?: () => void;
  onConfirm: (action: 'vote' | 'reveal') => void;
  voteHint?: string;
  compact?: boolean;
}

function GameControlPanel({
  room,
  modeRules,
  effectiveStatus,
  players,
  candidatePlayers,
  activeCandidatePlayers,
  currentPlayer,
  currentPlayerSecret,
  selectedVote,
  setSelectedVote,
  canGuess,
  canReveal,
  campaignTimedOut,
  busy,
  revealed,
  isObserver,
  isJuryMode,
  isUndercoverMode,
  result,
  copied,
  onStart,
  onCopyShare,
  onNewGame,
  onReplay,
  onConfirm,
  voteHint,
  compact = false,
}: GameControlPanelProps) {
  const selectedPlayer = candidatePlayers.find(player => player.id === selectedVote);
  const playerGridClass = compact
    ? 'grid grid-cols-2 gap-2'
    : 'grid grid-cols-2 gap-2';

  return (
    <div className={compact ? 'w-full max-w-full overflow-hidden rounded-lg border bg-card shadow-sm' : 'flex min-h-0 flex-col bg-card'}>
      <div className="border-b p-2.5 md:p-4">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="font-medium">{isUndercoverMode ? '玩家列表' : isJuryMode ? '法庭成员' : isObserver ? '候选玩家' : '玩家席位'}</div>
          <div className="text-xs text-muted-foreground">{activeCandidatePlayers.length}/{room.max_players}</div>
        </div>
        <div className={playerGridClass}>
          {candidatePlayers.map(player => {
            const isOut = !!player.eliminated_at && !revealed;
            const disabled = !canGuess || player.id === currentPlayer?.id || player.player_type === 'observer' || !!player.eliminated_at;
            const playerStatus = (() => {
              if (isOut) return <span className="font-medium text-red-500">已出局</span>;
              if (isUndercoverMode && revealed) {
                return (
                  <>
                    {parseUndercoverMeta(player.ai_persona)?.role === 'undercover' ? '卧底' : '平民'}
                    {player.eliminated_at && <span className="text-red-500"> · 已出局</span>}
                  </>
                );
              }
              if (isJuryMode && !revealed) return player.id === currentPlayer?.id ? '被告' : '法庭角色';
              if (revealed) return player.secret_role === 'ai' ? 'AI' : player.secret_role === 'observer' ? '观察者' : '真人';
              return player.id === currentPlayer?.id ? '你' : '身份未知';
            })();

            return (
              <button
                key={player.id}
                onClick={() => setSelectedVote(player.id)}
                disabled={disabled}
                className={`relative flex min-w-0 items-center gap-1.5 rounded-lg border p-2 text-left transition-colors ${selectedVote === player.id ? 'border-[#c2410c] bg-orange-50 dark:bg-orange-950/20' : 'hover:bg-accent'} ${player.id === currentPlayer?.id ? 'opacity-70' : ''}`}
              >
                <div className={`relative ${isOut ? 'opacity-50 grayscale' : ''}`}>
                  <PlayerAvatar player={player} revealed={revealed} compact={compact} />
                  {isOut && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-0.5 w-full rotate-45 rounded-full bg-red-500" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`truncate ${compact ? 'text-xs' : 'text-sm'} font-medium ${isOut ? 'line-through text-muted-foreground' : ''}`}>{player.display_name}</div>
                  <div className="truncate text-xs text-muted-foreground">{playerStatus}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className={`${compact ? '' : 'flex-1 overflow-y-auto'} p-2.5 md:p-4`}>
        {isUndercoverMode && !isObserver && !revealed && room.status === 'playing' && !currentPlayerSecret?.word && (
          <div className="mb-3 rounded-lg border border-[#c2410c]/30 bg-orange-50 p-3 dark:bg-orange-950/20 animate-pulse">
            <div className="text-xs text-muted-foreground">正在分配词语…</div>
            <div className="mt-1 text-lg font-semibold tracking-normal text-[#c2410c]/60">生成中</div>
          </div>
        )}
        {isUndercoverMode && !isObserver && !revealed && currentPlayerSecret?.word && (
          <div className="mb-3 rounded-lg border border-[#c2410c]/30 bg-orange-50 p-3 dark:bg-orange-950/20">
            <div className="text-xs text-muted-foreground">你的词语</div>
            <div className="mt-1 text-2xl font-semibold tracking-normal text-[#c2410c]">{currentPlayerSecret.word}</div>
            <div className="mt-1 text-xs text-muted-foreground">描述时不能直接说出这个词。</div>
          </div>
        )}

        {selectedPlayer && canGuess && !revealed && (
          <div className="mb-3 rounded-lg border border-[#c2410c]/30 bg-orange-50 p-3 text-sm dark:bg-orange-950/20">
            已选择：<span className="font-medium">{selectedPlayer.display_name}</span>
          </div>
        )}

        {voteHint && !revealed && (
          <div className="mb-3 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            {voteHint}
          </div>
        )}

        {campaignTimedOut && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
            本关已超时，挑战失败。身份不会揭晓，可以重玩本关。
            {!isObserver && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={onNewGame}>
                  返回地图
                </Button>
                <Button size="sm" onClick={onReplay || onNewGame} disabled={busy} className="bg-[#c2410c] text-white hover:bg-[#9a3412]">
                  重玩本关
                </Button>
              </div>
            )}
          </div>
        )}

        {room.status === 'waiting' && (
          <div className="space-y-3">
            {isObserver ? (
              <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                <div className="font-medium text-foreground">围观中</div>
                <div className="mt-1">房主开始后会自动进入观看，本模式不能操作房间。</div>
              </div>
            ) : (
              <>
            {!compact && (
              <div className="rounded-lg bg-muted p-3">
                <div className="mb-2 text-sm font-medium">本局规则</div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>{modeRules.setup}</p>
                  <p>{modeRules.goal}</p>
                  <p>{modeRules.winCondition}</p>
                </div>
              </div>
            )}
            {!compact && (
              <div className="rounded-lg bg-muted p-3">
                <div className="mb-2 text-sm font-medium">流程</div>
                <RuleList items={modeRules.flow} />
              </div>
            )}
            <Button onClick={onStart} disabled={busy || !currentPlayer} className="w-full bg-[#c2410c] text-white hover:bg-[#9a3412]">
              {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />正在生成词组…</> : <><Play className="mr-2 h-4 w-4" />开始游戏</>}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigator.clipboard.writeText(room.id).then(() => toast.success('房间 ID 已复制'))}
            >
              <Copy className="mr-2 h-4 w-4" />
              复制房间 ID
            </Button>
              </>
            )}
          </div>
        )}

        {effectiveStatus === 'playing' && !campaignTimedOut && (
          <div className="space-y-3">
            {isObserver ? (
              <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                <div className="font-medium text-foreground">围观中</div>
                <div className="mt-1">你正在观看本局，不能发言、投票或揭晓身份。</div>
              </div>
            ) : (
              <>
            {!compact && (
              <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                {isUndercoverMode
                  ? '描述自己的词，观察发言方向，觉得可疑就投票。'
                  : '继续提问观察，选中可疑玩家后投票。'}
              </div>
            )}
            {!isJuryMode && (
               <Button variant="outline" onClick={() => onConfirm('vote')} disabled={!selectedVote || !currentPlayer || busy} className="w-full">
                {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />投票中…</> : <><Vote className="mr-2 h-4 w-4" />{isUndercoverMode ? '提交投票' : '投给选中的玩家'}</>}
              </Button>
            )}
            <Button onClick={() => onConfirm('reveal')} disabled={!canReveal || busy} className="w-full">
              {isUndercoverMode ? '揭晓身份' : isJuryMode ? '请求宣判' : '直接揭晓'}
            </Button>
              </>
            )}
          </div>
        )}

        {effectiveStatus === 'voting' && !isJuryMode && !campaignTimedOut && !isObserver && (
          <div className="space-y-3">
            <Button onClick={() => onConfirm('vote')} disabled={!selectedVote || !currentPlayer || busy} className="w-full bg-[#c2410c] text-white hover:bg-[#9a3412]">
              {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />投票中…</> : '提交投票'}
            </Button>
            <Button variant="outline" onClick={() => onConfirm('reveal')} disabled={!canReveal || busy} className="w-full">
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
                      <div className="min-w-0 flex-1 truncate text-sm">{player.display_name}</div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${isHighlight ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'}`}>
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
            {isUndercoverMode && !isObserver && (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-xs text-muted-foreground">闯关结果</div>
                  <div className="mt-1 text-lg font-semibold">{resultStars(result) > 0 ? '成功' : '失败'}</div>
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
            {!isObserver && (
              <>
                <Button onClick={onCopyShare} className="w-full">
                  {copied ? <Check className="mr-2 h-4 w-4" /> : <Share2 className="mr-2 h-4 w-4" />}
                  生成战绩卡
                </Button>
                {!onReplay && (
                  <Button onClick={onNewGame} className="w-full bg-[#c2410c] text-white hover:bg-[#9a3412]">
                    <Play className="mr-2 h-4 w-4" />
                    再来一局
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface MobileActionCardProps extends GameControlPanelProps {
  voteOpen: boolean;
  setVoteOpen: (open: boolean) => void;
}

function MobileActionCard({
  room,
  players,
  candidatePlayers,
  currentPlayer,
  currentPlayerSecret,
  selectedVote,
  setSelectedVote,
  canGuess,
  canReveal,
  campaignTimedOut,
  busy,
  revealed,
  isObserver,
  isJuryMode,
  isUndercoverMode,
  onReplay,
  result,
  copied,
  effectiveStatus,
  onStart,
  onCopyShare,
  onNewGame,
  onConfirm,
  voteHint,
  voteOpen,
  setVoteOpen,
}: MobileActionCardProps) {
  const selectedPlayer = candidatePlayers.find(player => player.id === selectedVote);
  const showVotePicker = (voteOpen || effectiveStatus === 'voting') && canGuess && !revealed;

  if (room.status === 'waiting') {
    if (isObserver) {
      return (
        <div className="rounded-lg border bg-card p-3 shadow-sm md:hidden">
          <div className="text-sm font-medium">围观中</div>
          <div className="mt-1 text-xs text-muted-foreground">房主开始后会自动进入观看，本模式不能操作房间。</div>
        </div>
      );
    }

    return (
      <div className="rounded-lg border bg-card p-3 shadow-sm md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">等待开局</div>
            <div className="text-xs text-muted-foreground">已入座 {players.length}/{room.max_players}</div>
          </div>
          <Button size="sm" onClick={onStart} disabled={busy || !currentPlayer} className="bg-[#c2410c] text-white hover:bg-[#9a3412]">
            {busy ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />生成中…</> : <><Play className="mr-1 h-3.5 w-3.5" />开始</>}
          </Button>
        </div>
        {!onReplay && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-full"
            onClick={() => navigator.clipboard.writeText(room.id).then(() => toast.success('房间 ID 已复制'))}
          >
            <Copy className="mr-1 h-3.5 w-3.5" />
            复制房间 ID
          </Button>
        )}
      </div>
    );
  }

  if (revealed) {
    const wordPairMatch = result?.summary?.match(/平民词是「(.+?)」，卧底词是「(.+?)」/);
    return (
      <div className="rounded-lg border bg-card p-2.5 shadow-sm md:hidden">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-xs font-medium">{isUndercoverMode
              ? (resultStars(result) > 0 ? '✅ 闯关成功' : '❌ 闯关失败')
              : isJuryMode ? '已宣判' : '身份揭晓'}</span>
          </div>
          {!isObserver && (
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" onClick={onCopyShare} className="h-7 px-2 text-xs">
                {copied ? <Check className="mr-1 h-3 w-3" /> : <Share2 className="mr-1 h-3 w-3" />}
                分享
              </Button>
              {!onReplay && (
                <Button onClick={onNewGame} size="sm" className="h-7 bg-[#c2410c] px-2 text-xs text-white hover:bg-[#9a3412]">
                  <Play className="mr-1 h-3 w-3" />
                  再来一局
                </Button>
              )}
            </div>
          )}
        </div>
        {wordPairMatch && (
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>平民词：<b className="text-foreground">{wordPairMatch[1]}</b></span>
            <span>·</span>
            <span>卧底词：<b className="text-foreground">{wordPairMatch[2]}</b></span>
          </div>
        )}
      </div>
    );
  }

  if (campaignTimedOut) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 shadow-sm md:hidden dark:border-red-900/40 dark:bg-red-950/20">
        <div className="text-sm font-medium text-red-700 dark:text-red-300">挑战失败</div>
        <div className="mt-1 text-xs text-red-600 dark:text-red-300">本关已超时，身份不会揭晓。</div>
        {!isObserver && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={onNewGame}>
              返回地图
            </Button>
            <Button size="sm" onClick={onReplay || onNewGame} disabled={busy} className="bg-[#c2410c] text-white hover:bg-[#9a3412]">
              重玩本关
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (effectiveStatus !== 'playing' && effectiveStatus !== 'voting') {
    return null;
  }

  if (isObserver) {
    return (
      <div className="rounded-lg border bg-card p-3 shadow-sm md:hidden">
        <div className="text-sm font-medium">围观中</div>
        <div className="mt-1 text-xs text-muted-foreground">你正在观看本局，不能发言、投票或揭晓身份。</div>
      </div>
    );
  }

  if (!showVotePicker) {
    return (
      <div className="rounded-lg border bg-card p-2 shadow-sm md:hidden">
        <div className="flex items-center gap-2">
      {isUndercoverMode && !isObserver && !currentPlayerSecret?.word && room.status === 'playing' && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-muted px-3 py-2 animate-pulse">
          <span className="text-xs text-muted-foreground">正在分配词语…</span>
          <span className="text-sm font-semibold text-[#c2410c]/60">生成中</span>
        </div>
      )}
      {isUndercoverMode && !isObserver && currentPlayerSecret?.word && (
            <div className="min-w-0 flex-1 rounded-lg border border-[#c2410c]/25 bg-orange-50 px-2.5 py-1.5 dark:bg-orange-950/20">
              <div className="text-[11px] leading-4 text-muted-foreground">你的词语</div>
              <div className="truncate text-sm font-semibold tracking-normal text-[#c2410c]">{currentPlayerSecret.word}</div>
            </div>
          )}
          {!isJuryMode && (
            <Button onClick={() => setVoteOpen(true)} disabled={!canGuess} variant="outline" size="sm" className="h-10 flex-none">
              <Vote className="mr-1 h-3.5 w-3.5" />
              投票
            </Button>
          )}
          <Button onClick={() => onConfirm('reveal')} disabled={!canReveal || busy} variant="outline" size="sm" className="h-10 flex-none">
            {isUndercoverMode ? '揭晓' : isJuryMode ? '请求宣判' : '揭晓'}
          </Button>
        </div>
        {voteHint && <div className="mt-1.5 text-xs text-muted-foreground">{voteHint}</div>}
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm md:hidden">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium">选择怀疑对象</div>
          <div className="truncate text-xs text-muted-foreground">
            {selectedPlayer ? `当前选择：${selectedPlayer.display_name}` : '先选一个玩家再提交投票'}
          </div>
        </div>
        <Button onClick={() => setVoteOpen(false)} variant="ghost" size="sm" className="h-8 flex-none px-2">
          收起
        </Button>
      </div>

      {isUndercoverMode && !isObserver && !currentPlayerSecret?.word && room.status === 'playing' && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-muted px-3 py-2 animate-pulse">
          <span className="text-xs text-muted-foreground">正在分配词语…</span>
          <span className="text-sm font-semibold text-[#c2410c]/60">生成中</span>
        </div>
      )}
      {isUndercoverMode && !isObserver && currentPlayerSecret?.word && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-muted px-3 py-2">
          <span className="text-xs text-muted-foreground">你的词语</span>
          <span className="max-w-[60%] truncate text-sm font-semibold text-[#c2410c]">{currentPlayerSecret.word}</span>
        </div>
      )}

      <div className="mb-2 max-h-[24dvh] overflow-y-auto pr-0.5">
        <div className="grid grid-cols-2 gap-2">
          {candidatePlayers.map(player => {
            const disabled = player.id === currentPlayer?.id || player.player_type === 'observer' || !!player.eliminated_at;
            return (
              <button
                key={player.id}
                onClick={() => setSelectedVote(player.id)}
                disabled={disabled}
                className={`min-w-0 rounded-lg border px-2 py-2 text-left transition-colors ${selectedVote === player.id ? 'border-[#c2410c] bg-orange-50 dark:bg-orange-950/20' : 'bg-background'} ${disabled ? 'opacity-50' : 'active:bg-accent'}`}
              >
                <div className="truncate text-xs font-medium">{player.display_name}</div>
                <div className="text-xs text-muted-foreground">{player.id === currentPlayer?.id ? '你' : player.eliminated_at ? '已出局' : '可投票'}</div>
              </button>
            );
          })}
        </div>
      </div>

      <Button onClick={() => onConfirm('vote')} disabled={!selectedVote || !currentPlayer || busy} size="sm" className="w-full bg-[#c2410c] text-white hover:bg-[#9a3412]">
        {busy ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />投票中…</> : <><Vote className="mr-1 h-3.5 w-3.5" />提交投票</>}
      </Button>
    </div>
  );
}

function AiGameHome() {
  const navigate = useNavigate();
  const challengeLevelNumber = typeof window !== 'undefined' ? parseChallengeLevel(window.location.search) : null;
  const [homeSection, setHomeSection] = useState<'menu' | 'campaign' | 'practice'>(() => challengeLevelNumber ? 'campaign' : 'menu');
  const [mode, setMode] = useState(aiGameModes[0].id);
  const [name, setName] = useState(localStorage.getItem('ai-game-name') || '');
  const [roomId, setRoomId] = useState('');
  const [creating, setCreating] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [campaignProgress] = useState<CampaignProgress>(() => loadCampaignProgress());

  const [joining, setJoining] = useState(false);

  const selectedMode = aiGameModes.find(item => item.id === mode) || aiGameModes[0];
  const visibleCampaignLevels = useMemo(() => {
    const levels = getCampaignWindow(Math.max(campaignProgress.highestUnlockedLevel, challengeLevelNumber || 1));
    if (!challengeLevelNumber || levels.some(level => level.levelNumber === challengeLevelNumber)) return levels;
    return [generateCampaignLevel(challengeLevelNumber), ...levels].sort((a, b) => a.levelNumber - b.levelNumber);
  }, [campaignProgress.highestUnlockedLevel, challengeLevelNumber]);
  const clearedLevels = useMemo(() => Object.values(campaignProgress.bestStars).filter(stars => stars > 0).length, [campaignProgress.bestStars]);

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
        navigate(`/ai-game/${id}`);
      } else {
        toast.info(`房间「${targetRoom.title}」进行中，将作为旁观者加入`);
        navigate(`/ai-game/${id}?observe=1`);
      }
    } catch (error: any) {
      toast.error(error.message || '房间查询失败');
    } finally {
      setJoining(false);
    }
  };

  const createCampaignRoom = async (level: AiGameCampaignLevel) => {
    setCreating(true);
    try {
      const roomRes = await request('/api/ai-game/rooms', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'undercover',
          title: `卧底晋级赛 · ${level.title}`,
          maxPlayers: level.maxPlayers,
          aiCount: level.aiCount,
          durationSeconds: level.durationSeconds,
          wordTier: level.wordTier,
          campaignLevel: level.levelNumber,
          undercoverCount: level.undercoverCount,
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
      localStorage.setItem(roomLevelStorageKey(newRoomId), String(level.levelNumber));
      localStorage.setItem('ai-game-name', name || '玩家1');
      navigate(`/ai-game/${newRoomId}`);
    } catch (error: any) {
      toast.error(error.message || '关卡创建失败');
    } finally {
      setCreating(false);
    }
  };

  const isLevelUnlocked = (level: AiGameCampaignLevel) => level.levelNumber <= campaignProgress.highestUnlockedLevel || level.levelNumber === challengeLevelNumber;

  const shareGame = async () => {
    const url = buildAiGameChallengeUrl(window.location.href, null);
    const title = '卧底晋级赛';
    const text = '来玩一局谁是卧底，和一群 AI 玩家一起找卧底。';
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setShareCopied(true);
        toast.success('游戏链接已复制');
        setTimeout(() => setShareCopied(false), 1800);
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      await navigator.clipboard.writeText(`${text} ${url}`);
      setShareCopied(true);
      toast.success('游戏链接已复制');
      setTimeout(() => setShareCopied(false), 1800);
    }
  };

  return (
    <div className="fixed inset-0 overflow-y-auto bg-background">
      <div className="mx-auto flex min-h-full max-w-5xl flex-col px-4 py-6 md:py-10">
        <div className="mb-6 flex items-center justify-between">
          <Button variant="outline" onClick={() => homeSection === 'menu' ? navigate('/') : setHomeSection('menu')}>
            {homeSection === 'menu' ? '返回群聊' : '返回'}
          </Button>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
              <Bot className="h-4 w-4" />
              真人 AI 混聊局
            </div>
            <Button variant="outline" size="sm" onClick={shareGame}>
              {shareCopied ? <Check className="mr-1 h-4 w-4" /> : <Share2 className="mr-1 h-4 w-4" />}
              分享游戏
            </Button>
          </div>
        </div>

        {homeSection === 'menu' && (
          <div className="grid flex-1 content-center gap-4 md:grid-cols-2">
            <button
              onClick={() => setHomeSection('campaign')}
              className="min-w-0 rounded-lg border bg-card p-5 text-left shadow-sm transition-colors hover:bg-accent"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Flag className="h-5 w-5 text-[#c2410c]" />
                  <h1 className="text-xl font-semibold tracking-normal">卧底晋级赛</h1>
                </div>
                <div className="flex text-[#c2410c]">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Star key={index} className="h-4 w-4 fill-current" />
                  ))}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">逐关挑战谁是卧底，从明显破绽到高压反杀。</p>
              <div className="mt-4 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                <div className="font-medium text-foreground">本地进度</div>
                <div className="mt-1">最高第 {campaignProgress.highestUnlockedLevel} 关 · 已通关 {clearedLevels} 关</div>
              </div>
            </button>

            <button
              onClick={() => setHomeSection('practice')}
              className="min-w-0 rounded-lg border bg-card p-5 text-left shadow-sm transition-colors hover:bg-accent"
            >
              <div className="mb-3 flex items-center gap-2">
                <Play className="h-5 w-5 text-[#c2410c]" />
                <h1 className="text-xl font-semibold tracking-normal">自由练习</h1>
              </div>
              <p className="text-sm text-muted-foreground">不计入闯关进度，直接开一局当前玩法练手，也可以加入已有房间。</p>
              <div className="mt-4 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                <div className="font-medium text-foreground">当前玩法</div>
                <div className="mt-1">{selectedMode.name} · {selectedMode.maxPlayers - selectedMode.aiCount} 真人 + {selectedMode.aiCount} AI</div>
              </div>
            </button>
          </div>
        )}

        {homeSection === 'campaign' && (
        <section className="mb-6 rounded-lg border bg-card p-4 shadow-sm md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-[#c2410c]" />
                <h1 className="text-lg font-semibold tracking-normal">卧底晋级赛</h1>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">逐关挑战谁是卧底，从明显破绽到高压反杀。</p>
            </div>
            <div className="hidden rounded-lg bg-muted px-3 py-2 text-right text-xs text-muted-foreground md:block">
              <div className="font-medium text-foreground">本地进度</div>
              <div>最高第 {campaignProgress.highestUnlockedLevel} 关 · 已通关 {clearedLevels} 关</div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {visibleCampaignLevels.map((level) => {
              const stars = campaignProgress.bestStars[String(level.levelNumber)] || 0;
              const unlocked = isLevelUnlocked(level);
              return (
                <button
                  key={level.id}
                  onClick={() => unlocked && createCampaignRoom(level)}
                  disabled={!unlocked || creating}
                  className={`min-w-0 rounded-lg border p-3 text-left transition-colors ${unlocked ? 'bg-background hover:bg-accent' : 'cursor-not-allowed bg-muted/60 opacity-70'} ${stars || level.levelNumber === challengeLevelNumber ? 'border-[#c2410c]/50' : ''}`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-xs font-medium text-muted-foreground">{level.levelNumber === challengeLevelNumber ? '好友挑战' : level.chapter}</div>
                    {unlocked ? (
                      <div className="flex text-[#c2410c]">
                        {Array.from({ length: 3 }).map((_, starIndex) => (
                          <Star key={starIndex} className={`h-3.5 w-3.5 ${starIndex < stars ? 'fill-current' : 'opacity-30'}`} />
                        ))}
                      </div>
                    ) : (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="truncate text-sm font-semibold">{level.levelNumber}. {level.title}</div>
                  <p className="mt-1 line-clamp-2 min-h-10 text-xs text-muted-foreground">{level.description}</p>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="rounded-md bg-muted px-2 py-1">难度 {level.difficulty}</span>
                    <span className="text-muted-foreground">{level.maxPlayers} 人 · {level.undercoverCount} 卧底 · {Math.round(level.durationSeconds / 60)} 分钟</span>
                  </div>
                  <div className="mt-2 truncate text-xs text-[#c2410c]">{level.modifier}</div>
                </button>
              );
            })}
          </div>
        </section>
        )}

        {homeSection === 'practice' && (
        <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-lg border bg-card p-5 shadow-sm">
            <div className="mb-5">
              <h1 className="text-2xl font-semibold tracking-normal">自由练习</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                不计入闯关进度，直接开一局当前玩法练手。
              </p>
            </div>

            <div className="grid gap-3">
              {aiGameModes.map(item => (
                <button
                  key={item.id}
                  onClick={() => setMode(item.id)}
                  className={`rounded-lg border p-4 text-left transition-colors ${mode === item.id ? 'border-[#c2410c] bg-orange-50 dark:bg-orange-950/20' : 'bg-background hover:bg-accent'}`}
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
              <Play className="h-4 w-4 text-[#c2410c]" />
              <h2 className="font-medium">快速开局</h2>
            </div>
            <div className="space-y-3">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={16}
                placeholder="你的昵称"
              />
              <Button onClick={createRoom} disabled={creating} className="w-full bg-[#c2410c] text-white hover:bg-[#9a3412]">
                {creating ? '创建中...' : '创建并加入'}
              </Button>
            </div>

            <div className="my-5 border-t" />

            <div className="mb-4 flex items-center gap-2">
              <Users className="h-4 w-4 text-[#c2410c]" />
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
        )}
      </div>
    </div>
  );
}

function AiGameRoom() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const observeInvite = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('observe') === '1';
  const [room, setRoom] = useState<GameRoomData | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [result, setResult] = useState<GameResult | null>(null);
  const [currentPlayerSecret, setCurrentPlayerSecret] = useState<CurrentPlayerSecret | null>(null);
  const [messages, setMessages] = useState<GameMessage[]>([]);
  const [name, setName] = useState(localStorage.getItem('ai-game-name') || '');
  const [input, setInput] = useState('');
  const [playerId, setPlayerId] = useState(() => localStorage.getItem(playerStorageKey(roomId)) || '');
  const [campaignLevelId, setCampaignLevelId] = useState(() => localStorage.getItem(roomLevelStorageKey(roomId)) || '');
  const [selectedVote, setSelectedVote] = useState('');
  const [mobileVoteOpen, setMobileVoteOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [votingPending, setVotingPending] = useState(false);
  const [postGameReviewPending, setPostGameReviewPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'vote' | 'reveal' | null>(null);
  const lastMessageIdRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const observeJoinAttemptedRef = useRef('');

  const currentPlayer = useMemo(() => players.find(player => player.id === playerId), [players, playerId]);
  const latestUndercoverVoteResultId = useMemo(() => {
    const voteResults = messages.filter(message => message.sender_type === 'system' && message.content.startsWith('投票完成'));
    return voteResults.length ? voteResults[voteResults.length - 1].id : 0;
  }, [messages]);
  const latestOwnDescriptionId = useMemo(() => {
    const ownMessages = messages.filter(message => message.player_id === playerId && message.sender_type === 'human');
    return ownMessages.length ? ownMessages[ownMessages.length - 1].id : 0;
  }, [messages, playerId]);
  const aiMessagesAfterOwnDescriptionCount = useMemo(() => {
    if (!latestOwnDescriptionId) return 0;
    return messages.filter(message => message.sender_type === 'ai' && message.id > latestOwnDescriptionId).length;
  }, [latestOwnDescriptionId, messages]);
  const campaignLevel = useMemo(() => {
    const levelNumber = Number(campaignLevelId.replace(/^u/, ''));
    return Number.isFinite(levelNumber) && levelNumber > 0 ? generateCampaignLevel(levelNumber) : null;
  }, [campaignLevelId]);
  const candidatePlayers = useMemo(() => players.filter(player => player.player_type !== 'observer'), [players]);
  const activeCandidatePlayers = useMemo(() => candidatePlayers.filter(player => !player.eliminated_at), [candidatePlayers]);
  const revealed = room?.status === 'revealed' || room?.status === 'archived';
  const startedAt = toUtcDate(room?.started_at);
  const endsAt = startedAt && room ? new Date(startedAt.getTime() + room.duration_seconds * 1000) : null;
  const [now, setNow] = useState(Date.now());
  const secondsLeft = endsAt ? Math.max(0, Math.ceil((endsAt.getTime() - now) / 1000)) : room?.duration_seconds || 0;
  const effectiveStatus = room?.status === 'playing' && secondsLeft <= 0 && room.mode !== 'jury' && room.mode !== 'undercover' ? 'voting' : room?.status;

  useEffect(() => {
    setPlayerId(localStorage.getItem(playerStorageKey(roomId)) || '');
    setCampaignLevelId(localStorage.getItem(roomLevelStorageKey(roomId)) || '');
    setSelectedVote('');
    setMobileVoteOpen(false);
    setShareDialogOpen(false);
    setInput('');
    setRoom(null);
    setPlayers([]);
    setResult(null);
    setCurrentPlayerSecret(null);
    setVotingPending(false);
    setPostGameReviewPending(false);
    lastMessageIdRef.current = 0;
    setMessages([]);
  }, [roomId]);

  const loadRoom = useCallback(async () => {
    if (!roomId) return;
    const res = await request(`/api/ai-game/rooms?id=${roomId}${playerId ? `&player=${playerId}` : ''}`);
    const data = await res.json();
    const loadedRoom = data.data.room;
    setRoom(loadedRoom);
    if (!localStorage.getItem(roomLevelStorageKey(roomId)) && Number(loadedRoom?.campaign_level) > 0) {
      setCampaignLevelId(String(loadedRoom.campaign_level));
    }
    setPlayers(data.data.players || []);
    setResult(data.data.result || null);
    setCurrentPlayerSecret(data.data.currentPlayerSecret || null);
    return loadedRoom as GameRoomData;
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

  useEffect(() => {
    if (effectiveStatus === 'voting') {
      setMobileVoteOpen(true);
    }
  }, [effectiveStatus]);

  useEffect(() => {
    if (!campaignLevel || !result || (room?.status !== 'revealed' && room?.status !== 'archived')) return;
    const stars = resultStars(result);
    if (stars <= 0) return;
    const progress = loadCampaignProgress();
    const levelKey = String(campaignLevel.levelNumber);
    if ((progress.bestStars[levelKey] || 0) >= stars && progress.highestUnlockedLevel >= campaignLevel.levelNumber + 1) return;
    progress.bestStars[levelKey] = Math.max(progress.bestStars[levelKey] || 0, stars);
    progress.clearedAt[levelKey] = new Date().toISOString();
    progress.highestUnlockedLevel = Math.max(progress.highestUnlockedLevel, campaignLevel.levelNumber + 1);
    saveCampaignProgress(progress);
  }, [campaignLevel, result, room?.status]);

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

  const joinAsObserver = useCallback(async () => {
    if (!roomId || playerId || observeJoinAttemptedRef.current === roomId) return;
    observeJoinAttemptedRef.current = roomId;
    setBusy(true);
    try {
      const res = await request('/api/ai-game/join', {
        method: 'POST',
        body: JSON.stringify({ roomId, displayName: name || '观众', joinAs: 'observer' }),
      });
      const data = await res.json();
      localStorage.setItem(playerStorageKey(roomId), data.data.playerId);
      localStorage.setItem('ai-game-name', name || '观众');
      setPlayerId(data.data.playerId);
      if (data.data.message) toast.info(data.data.message);
      else toast.success('已进入围观模式');
    } catch (error: any) {
      observeJoinAttemptedRef.current = '';
      toast.error(error.message || '进入围观失败');
    } finally {
      setBusy(false);
    }
  }, [name, playerId, roomId]);

  useEffect(() => {
    if (observeInvite && !playerId) {
      joinAsObserver();
    }
  }, [joinAsObserver, observeInvite, playerId]);

  const start = async () => {
    if (!currentPlayer || isObserver) {
      toast.error('请先加入房间');
      return;
    }
    setBusy(true);
    try {
      await request('/api/ai-game/start', { method: 'POST', body: JSON.stringify({ roomId, playerId: currentPlayer.id }) });
      await loadRoom();
      await loadMessages();
    } catch (error: any) {
      toast.error(error.message || '开始失败');
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!input.trim() || !currentPlayer || currentStatus !== 'playing') return;
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

  const requestPostGameReviews = async () => {
    setPostGameReviewPending(true);
    try {
      await request('/api/ai-game/reviews', {
        method: 'POST',
        body: JSON.stringify({ roomId, playerId: currentPlayer?.id }),
      });
      await loadMessages();
    } catch (error: any) {
      toast.error(error.message || 'AI 复盘失败');
    } finally {
      setPostGameReviewPending(false);
    }
  };

  const vote = async () => {
    if (!selectedVote || !currentPlayer) return;
    setBusy(true);
    setVotingPending(true);
    setPostGameReviewPending(false);
    try {
      await request('/api/ai-game/vote', {
        method: 'POST',
        body: JSON.stringify({ roomId, voterPlayerId: currentPlayer.id, targetPlayerId: selectedVote }),
      });
      setVotingPending(false);
      toast.success('投票已提交');
      setSelectedVote('');
      setMobileVoteOpen(false);
      const loadedRoom = await loadRoom();
      await loadMessages();
      if (loadedRoom?.status === 'revealed' || loadedRoom?.status === 'archived') {
        await requestPostGameReviews();
      }
    } catch (error: any) {
      toast.error(error.message || '投票失败');
    } finally {
      setVotingPending(false);
      setBusy(false);
    }
  };

  const reveal = async () => {
    if (!currentPlayer || isObserver) {
      toast.error('只有玩家可以揭晓身份');
      return;
    }
    if (campaignLevel) {
      toast.error('闯关模式不能直接揭晓身份');
      return;
    }
    setBusy(true);
    try {
      await request('/api/ai-game/reveal', { method: 'POST', body: JSON.stringify({ roomId, playerId: currentPlayer.id }) });
      const loadedRoom = await loadRoom();
      await loadMessages();
      if (loadedRoom?.status === 'revealed' || loadedRoom?.status === 'archived') {
        await requestPostGameReviews();
      }
    } catch (error: any) {
      toast.error(error.message || '揭晓失败');
    } finally {
      setBusy(false);
    }
  };

  const copyShare = async () => {
    setShareDialogOpen(true);
  };

  const copyObserveInvite = async () => {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('observe', '1');
    await navigator.clipboard.writeText(url.toString());
    setCopied(true);
    toast.success('围观链接已复制');
    setTimeout(() => setCopied(false), 1800);
  };

  const createCampaignRoomFromLevel = async (level: AiGameCampaignLevel) => {
    setBusy(true);
    try {
      const roomRes = await request('/api/ai-game/rooms', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'undercover',
          title: `卧底晋级赛 · ${level.title}`,
          maxPlayers: level.maxPlayers,
          aiCount: level.aiCount,
          durationSeconds: level.durationSeconds,
          wordTier: level.wordTier,
          campaignLevel: level.levelNumber,
          undercoverCount: level.undercoverCount,
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
      localStorage.setItem(roomLevelStorageKey(newRoomId), String(level.levelNumber));
      localStorage.setItem('ai-game-name', name || '玩家1');
      navigate(`/ai-game/${newRoomId}`);
    } catch (error: any) {
      toast.error(error.message || '关卡创建失败');
    } finally {
      setBusy(false);
    }
  };

  if (!room) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#c2410c] border-t-transparent" />
      </div>
    );
  }

  const modeRules = aiGameModes.find(item => item.id === room.mode) || aiGameModes[0];
  const currentStatus = effectiveStatus || room.status;
  const isObserver = currentPlayer?.player_type === 'observer';
  const isJuryMode = room.mode === 'jury';
  const isUndercoverMode = room.mode === 'undercover';
  const currentPlayerEliminated = !!currentPlayer?.eliminated_at;
  const isParticipant = !!currentPlayer && !isObserver;
  const campaignTimedOut = !!campaignLevel && !revealed && room.status === 'playing' && secondsLeft <= 0;
  const activeAiCount = activeCandidatePlayers.filter(player => player.player_type === 'ai').length;
  const needsDescriptionBeforeVote = isUndercoverMode && latestOwnDescriptionId <= latestUndercoverVoteResultId;
  const needsAiRoundBeforeVote = isUndercoverMode && !needsDescriptionBeforeVote && aiMessagesAfterOwnDescriptionCount < Math.max(1, activeAiCount);
  const canVote = isParticipant && !currentPlayerEliminated && (currentStatus === 'playing' || currentStatus === 'voting') && !revealed && !needsDescriptionBeforeVote && !needsAiRoundBeforeVote && !campaignTimedOut;
  const canSpeak = isParticipant && !currentPlayerEliminated && currentStatus === 'playing' && !campaignTimedOut;
  const canReveal = isParticipant && !campaignLevel && !campaignTimedOut;
  const canGuess = canVote && !isJuryMode;
  const voteHint = needsDescriptionBeforeVote
    ? (latestUndercoverVoteResultId > 0 ? '上一轮已完成投票，请先继续描述或追问后再投下一轮。' : '先描述你的词或追问一次，再进行投票。')
    : needsAiRoundBeforeVote
      ? '请等 AI 完成本轮描述后再投票。'
      : undefined;
  const statusText = (() => {
    if (campaignTimedOut) return '挑战失败';
    if (revealed) return isJuryMode ? '已宣判' : '已揭晓';
    if (currentStatus === 'waiting') return '等待开局';
    if (isJuryMode && currentStatus === 'playing') return secondsLeft > 0 ? `庭审剩余 ${secondsLeft}s` : '可请求宣判';
    if (isUndercoverMode && currentStatus === 'playing') return '进行中';
    if (currentStatus === 'playing') return `剩余 ${secondsLeft}s`;
    if (currentStatus === 'voting') return '投票中';
    return '进行中';
  })();
  const showHeaderCountdown = currentStatus === 'playing' && !revealed && !campaignTimedOut && startedAt && room;
  const controlPanelProps = {
    room,
    modeRules,
    effectiveStatus: currentStatus,
    players,
    candidatePlayers,
    activeCandidatePlayers,
    currentPlayer,
    currentPlayerSecret,
    selectedVote,
    setSelectedVote,
    canGuess,
    canReveal,
    campaignTimedOut,
    busy,
    revealed,
    isObserver,
    isJuryMode,
    isUndercoverMode,
    result,
    copied,
    onStart: start,
    onCopyShare: copyShare,
    onNewGame: () => navigate('/ai-game'),
    onReplay: campaignLevel ? () => createCampaignRoomFromLevel(campaignLevel) : undefined,
    onConfirm: (action: 'vote' | 'reveal') => setConfirmAction(action),
    voteHint,
  };
  const nextCampaignLevel = campaignLevel ? generateCampaignLevel(campaignLevel.levelNumber + 1) : undefined;
  const campaignStars = campaignLevel && result && revealed ? resultStars(result) : 0;
  const challengeUrl = typeof window !== 'undefined'
    ? buildAiGameChallengeUrl(window.location.href, campaignLevel?.levelNumber)
    : '';
  const hasGameOverMessage = messages.some(message =>
    message.sender_type === 'system'
    && message.content.startsWith('投票完成')
    && (message.content.includes('游戏结束') || message.content.includes('身份已揭晓'))
  );
  const renderCampaignSettlementCard = () => {
    if (!campaignLevel || !revealed || !result) return null;
    return (
      <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
        <div className="mx-auto max-w-sm rounded-lg border bg-card p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold">晋级赛结算</div>
              <div className="truncate text-xs text-muted-foreground">{campaignLevel.title}</div>
            </div>
            <div className="flex text-[#c2410c]">
              {Array.from({ length: 3 }).map((_, index) => (
                <Star key={index} className={`h-4 w-4 ${index < campaignStars ? 'fill-current' : 'opacity-25'}`} />
              ))}
            </div>
          </div>
          <div className="rounded-lg bg-muted px-3 py-2 text-sm">
            {campaignStars > 0 ? '通关成功，下一关已解锁。' : '这关还没通关，重玩一次调整发言和投票策略。'}
          </div>
          {!isObserver && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => createCampaignRoomFromLevel(campaignLevel)} disabled={busy}>
                重玩
              </Button>
              {campaignStars > 0 && nextCampaignLevel ? (
                <Button size="sm" onClick={() => createCampaignRoomFromLevel(nextCampaignLevel)} disabled={busy} className="bg-[#c2410c] text-white hover:bg-[#9a3412]">
                  下一关
                </Button>
              ) : (
                <Button size="sm" onClick={() => navigate('/ai-game')} className="bg-[#c2410c] text-white hover:bg-[#9a3412]">
                  返回地图
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-background">
      <div className="flex h-full flex-col">
        <header className="flex flex-none items-center justify-between border-b bg-card px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/ai-game')}
              aria-label="返回"
              title="返回"
              className="h-8 w-8 flex-none rounded-full p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{room.title.replace(/\s*\[tier:[^\]]+\]/, '')}</div>
              <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                <span>{statusText}</span>
                {showHeaderCountdown && (
                  <span className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] font-medium ${
                    secondsLeft <= 30
                      ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                      : 'bg-muted text-foreground'
                  }`}>
                    {formatCountdown(secondsLeft)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={copyObserveInvite}>
            {copied ? <Check className="mr-1 h-4 w-4" /> : <Share2 className="mr-1 h-4 w-4" />}
            邀请围观
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
          <section className="flex min-w-0 min-h-0 flex-col bg-muted">
            <div className="min-w-0 flex-1 overflow-y-auto px-2 py-2 md:px-3 md:py-3">
              <div className="mx-auto max-w-3xl min-w-0 space-y-3">
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
                    const isVoteResult = message.content.startsWith('投票完成');
                    const isGameOver = isVoteResult && (message.content.includes('游戏结束') || message.content.includes('身份已揭晓'));
                    const isGameStart = message.content.startsWith('游戏开始') || message.content.startsWith('开庭') || message.content.startsWith('单人鉴定');
                    const isElimination = message.content.includes('出局') && !isGameOver;

                    if (isGameOver) {
                      const { votes: votePairs, eliminatedName, resultLines } = parseVoteResultMessage(message.content);
                      const visibleVoteNames = new Set(votePairs.flatMap(pair => [pair.voter, pair.target]));
                      const priorEliminatedPlayers = candidatePlayers.filter(player => player.eliminated_at && !visibleVoteNames.has(player.display_name));
                      return (
                        <div key={message.id} className="space-y-3">
                          <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                            <div className="mx-auto max-w-sm rounded-xl border-2 border-[#c2410c]/40 bg-gradient-to-br from-orange-50 to-amber-50 p-4 shadow-sm dark:from-orange-950/30 dark:to-amber-950/20 dark:border-[#c2410c]/30">
                              <Trophy className="mx-auto mb-2 h-6 w-6 text-[#c2410c]" />
                              <div className="text-center text-sm font-semibold text-foreground">游戏结束</div>
                              {(votePairs.length > 0 || priorEliminatedPlayers.length > 0) && (
                                <div className="mt-3 space-y-1.5 rounded-lg bg-white/60 p-2 dark:bg-black/20">
                                  {votePairs.map((pair, i) => {
                                    const voter = candidatePlayers.find(player => player.display_name === pair.voter);
                                    const target = candidatePlayers.find(player => player.display_name === pair.target);
                                    return (
                                      <VoteRecord
                                        key={i}
                                        voterName={pair.voter}
                                        targetName={pair.target}
                                        voterRole={getPlayerRoleLabel({ player: voter, isUndercoverMode })}
                                        targetRole={getPlayerRoleLabel({ player: target, isUndercoverMode })}
                                        targetEliminated={pair.target === eliminatedName}
                                      />
                                    );
                                  })}
                                  {priorEliminatedPlayers.map(player => (
                                    <EliminatedIdentityRecord
                                      key={player.id}
                                      player={player}
                                      isUndercoverMode={isUndercoverMode}
                                    />
                                  ))}
                                </div>
                              )}
                              {resultLines.length > 0 && (
                                <div className="mt-2 space-y-0.5 text-xs text-muted-foreground leading-relaxed text-center">
                                  {resultLines.map((line, i) => (
                                    <p key={i}>{line}</p>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          {renderCampaignSettlementCard()}
                        </div>
                      );
                    }

                    if (isVoteResult) {
                      const { votes: votePairs, eliminatedName, resultLines } = parseVoteResultMessage(message.content);
                      return (
                        <div key={message.id} className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                          <div className="mx-auto max-w-sm rounded-xl border border-red-200 bg-red-50/60 p-3 shadow-sm dark:border-red-900/40 dark:bg-red-950/20">
                            <div className="mb-2 flex items-center justify-center gap-1.5">
                              <Vote className="h-4 w-4 text-red-500" />
                              <span className="text-xs font-semibold text-red-700 dark:text-red-400">投票记录</span>
                            </div>
                            {votePairs.length > 0 && (
                              <div className="space-y-1.5 rounded-lg bg-white/60 p-2 dark:bg-black/20">
                                {votePairs.map((pair, i) => (
                                  <VoteRecord
                                    key={i}
                                    voterName={pair.voter}
                                    targetName={pair.target}
                                    targetEliminated={pair.target === eliminatedName}
                                  />
                                ))}
                              </div>
                            )}
                            {resultLines.length > 0 && (
                              <div className="mt-2 space-y-0.5 text-xs text-muted-foreground leading-relaxed text-center">
                                {resultLines.map((line, i) => (
                                  <p key={i}>{line}</p>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    if (isElimination) {
                      return (
                        <div key={message.id} className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                          <div className="mx-auto max-w-xs rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-2 text-center dark:border-amber-900/40 dark:bg-amber-950/20">
                            <AlertCircle className="mx-auto mb-1 h-3.5 w-3.5 text-amber-600" />
                            <div className="text-xs text-amber-800 dark:text-amber-300">{message.content}</div>
                          </div>
                        </div>
                      );
                    }

                    if (isGameStart) {
                      return (
                        <div key={message.id} className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                          <div className="mx-auto max-w-sm rounded-lg border border-[#c2410c]/30 bg-orange-50/60 px-4 py-2.5 text-center dark:bg-orange-950/20">
                            <Play className="mx-auto mb-1 h-3.5 w-3.5 text-[#c2410c]" />
                            <div className="text-xs font-medium text-[#c2410c]">{message.content}</div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={message.id} className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                        <div className="mx-auto max-w-xs rounded-lg bg-muted px-4 py-2 text-center">
                          <div className="text-xs text-muted-foreground">{message.content}</div>
                        </div>
                      </div>
                    );
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
                        <div className={`mt-1 rounded-lg px-3 py-2 text-sm shadow-sm ${mine ? 'bg-blue-600 text-left text-white' : 'bg-card'}`}>
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
                {!hasGameOverMessage && renderCampaignSettlementCard()}
                {votingPending && (
                  <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    AI 正在投票，等待结果…
                  </div>
                )}
                {postGameReviewPending && (
                  <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    AI 正在复盘…
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="flex-none border-t bg-card p-2" style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}>
              <div className="mx-auto mb-2 max-w-3xl">
                <MobileActionCard {...controlPanelProps} voteOpen={mobileVoteOpen} setVoteOpen={setMobileVoteOpen} />
              </div>
              {isObserver ? (
                <div className="text-center text-sm text-muted-foreground">你正在围观本局</div>
              ) : !currentPlayer && room.status === 'waiting' ? (
                <div className="mx-auto flex max-w-3xl gap-2">
                  <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={16} placeholder="你的昵称" />
                  <Button onClick={join} disabled={busy}>加入</Button>
                </div>
              ) : currentStatus === 'playing' ? (
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

          <aside className="hidden min-h-0 border-l bg-card md:flex">
            <GameControlPanel {...controlPanelProps} />
          </aside>
        </main>
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
              className="bg-[#c2410c] text-white hover:bg-[#9a3412]"
              onClick={async () => {
                const action = confirmAction;
                setConfirmAction(null);
                if (action === 'vote') {
                  await vote();
                } else if (action === 'reveal') {
                  await reveal();
                }
              }}
              disabled={busy || (confirmAction === 'reveal' && !canReveal)}
            >
              {busy ? '处理中...' : '确认'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {revealed && (
        <AiGameShareDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          room={room}
          result={result}
          campaignLevel={campaignLevel}
          campaignStars={campaignStars}
          currentPlayerSecret={currentPlayerSecret}
          challengeUrl={challengeUrl}
        />
      )}
    </div>
  );
}

export default function AiGamePage() {
  const { roomId } = useParams();
  return roomId ? <AiGameRoom /> : <AiGameHome />;
}
