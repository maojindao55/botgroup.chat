export type AiGameMode = 'undercover' | 'jury' | 'solo' | 'classic' | 'reverse' | 'topic';
export type AiGameStatus = 'waiting' | 'playing' | 'voting' | 'revealed' | 'archived';

export const aiGameModes = [
  {
    id: 'undercover' as const,
    name: '谁是卧底',
    description: '你和一群 AI 玩家拿到相近词语，轮流描述，投票找卧底。',
    goal: '平民要找出卧底；如果你是卧底，就投一个平民背锅。',
    setup: '1 个真人 + 5 个 AI 玩家。全场只有 1 个卧底，大家只知道自己的词。',
    flow: ['开局后先看自己的词语', '每轮轮流描述词语特征，不能直接说出词', '自由讨论和互相质疑后投票', '最高票玩家出局，身份暂不公布，存活玩家继续下一轮', '卧底出局则平民胜；真人出局或人数过少则卧底胜'],
    winCondition: '你是平民时找出卧底获胜；你是卧底时活下来并带偏投票获胜。',
    maxPlayers: 6,
    aiCount: 5,
    durationSeconds: 240,
  },
];

export const aiGameGlobalRules = [
  '描述时不能直接说出自己的词。',
  '可以含糊、误导、怀疑别人，但不要自爆。',
  '如果你是卧底，目标是把票投给平民，让自己安全过关。',
  '揭晓前只显示你自己的词，不显示其他玩家身份。',
];

export interface AiGameCampaignLevel {
  id: string;
  levelNumber: number;
  chapter: string;
  title: string;
  description: string;
  maxPlayers: number;
  aiCount: number;
  durationSeconds: number;
  difficulty: number;
  wordTier: 'obvious' | 'close' | 'contextual' | 'abstract';
  objective: string;
  modifier: string;
}

const campaignTitlePool = [
  '明显的异类',
  '跟风的人',
  '相近词陷阱',
  '带偏投票',
  '抽象词',
  '卧底反杀',
  '短时追问',
  '反向观察',
  '票型迷雾',
  '高压终局',
];

const campaignModifierPool = [
  '词语差异明显',
  'AI 更爱顺着多数人说',
  '词语更接近',
  '讨论时间缩短',
  '抽象词语',
  '身份压力局',
  '需要更快锁定矛盾',
  '描述更容易互相覆盖',
  '票型更容易被带偏',
  '容错更低',
];

const campaignObjectives = [
  '找出拿到不同词语的卧底。',
  '在附和和真实描述之间找到破绽。',
  '用追问逼出词语边界。',
  '投票时坚持自己的证据链。',
  '找出描述最空泛的玩家。',
  '如果你是卧底，就成功甩锅；如果你是平民，就找出卧底。',
];

function getCampaignChapter(level: number) {
  if (level <= 5) return '入门局';
  if (level <= 15) return '标准局';
  if (level <= 30) return '进阶局';
  if (level <= 60) return '高手局';
  return '无限挑战';
}

function getCampaignWordTier(level: number): AiGameCampaignLevel['wordTier'] {
  if (level <= 5) return level === 1 ? 'obvious' : 'close';
  if (level <= 15) return 'close';
  if (level <= 30) return 'contextual';
  return 'abstract';
}

function getCampaignDescription(level: number, title: string, wordTier: AiGameCampaignLevel['wordTier']) {
  if (level === 1) return '词语差异比较大，先学会观察谁的描述方向不对。';
  if (level === 2) return '卧底会附和别人，重点看谁只重复、不补细节。';
  if (level === 3) return '平民词和卧底词接近，模糊描述会更有迷惑性。';
  if (level === 4) return '这关要关注票型，别被看似合理的怀疑带走。';
  if (level === 5) return '抽象词会让所有人都说得像真的，需要看具体例子。';
  if (level === 6) return '你可能就是卧底。目标不是找人，而是把票导向平民。';

  const tierText = {
    obvious: '差异明显',
    close: '相近词',
    contextual: '场景词',
    abstract: '抽象词',
  }[wordTier];
  return `${title}关卡，词组类型为${tierText}，需要结合发言细节、追问和票型判断。`;
}

export function generateCampaignLevel(levelNumber: number): AiGameCampaignLevel {
  const level = Math.max(1, Math.floor(Number(levelNumber) || 1));
  const difficulty = Math.min(10, 1 + Math.floor((level - 1) / 5));
  const wordTier = getCampaignWordTier(level);
  const titleBase = campaignTitlePool[(level - 1) % campaignTitlePool.length];
  const modifier = campaignModifierPool[(level - 1) % campaignModifierPool.length];
  const title = level <= 6 ? titleBase : `${titleBase} ${level}`;
  const maxPlayers = level <= 1 ? 4 : level <= 2 ? 5 : level <= 30 ? 6 : 7;
  const durationSeconds = Math.max(150, 270 - Math.floor((level - 1) / 4) * 10);

  return {
    id: `u${level}`,
    levelNumber: level,
    chapter: getCampaignChapter(level),
    title,
    description: getCampaignDescription(level, titleBase, wordTier),
    maxPlayers,
    aiCount: maxPlayers - 1,
    durationSeconds,
    difficulty,
    wordTier,
    objective: campaignObjectives[(level - 1) % campaignObjectives.length],
    modifier,
  };
}

export function getCampaignWindow(highestUnlockedLevel: number) {
  const highest = Math.max(1, Math.floor(Number(highestUnlockedLevel) || 1));
  const start = Math.max(1, highest - 3);
  const end = highest + 6;
  return Array.from({ length: end - start + 1 }, (_, index) => generateCampaignLevel(start + index));
}

export const aiGamePersonas = [
  '24 岁互联网运营，刚下班，回复偏短，不爱解释，偶尔只回半句话。',
  '大三学生，语气随意，不总接梗，偶尔回得有点敷衍。',
  '自由职业设计师，表达普通，不刻意文艺，常用生活化短句。',
  '程序员，话少，不太主动展开，偶尔只回“差不多”。',
  '普通打工人，关注吃饭、通勤和周末，语气平淡。',
  '社恐网友，存在感低，回复慢半拍，常用简短口语。',
  '创业者，表达直接，但不输出大道理，像普通群友插一句。',
  '追剧爱好者，偶尔跑到影视话题，但不会强行抖机灵。',
];
