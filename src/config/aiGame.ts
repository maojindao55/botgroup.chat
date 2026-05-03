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
