import OpenAI from 'openai';
import { modelConfigs } from '../../src/config/aiCharacters';
import { generateUndercoverFallbackReply } from './aiGameFallback';
import { hashStringToIndex } from './aiGameWords';

export const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

export const publicRoomFields = `
  id, mode, status, title, max_players, ai_count, duration_seconds,
  message_limit, created_by, started_at, ended_at, created_at
`;

const personas = [
  '24 岁互联网运营，刚下班，回复偏短，不爱解释，偶尔只回半句话。',
  '大三学生，语气随意，不总接梗，偶尔回得有点敷衍。',
  '自由职业设计师，表达普通，不刻意文艺，常用生活化短句。',
  '程序员，话少，不太主动展开，偶尔只回“差不多”。',
  '普通打工人，关注吃饭、通勤和周末，语气平淡。',
  '社恐网友，存在感低，回复慢半拍，常用简短口语。',
  '创业者，表达直接，但不输出大道理，像普通群友插一句。',
  '追剧爱好者，偶尔跑到影视话题，但不会强行抖机灵。',
];

const names = ['阿北', '小唐', 'Mika', '林一', '小周', 'Nora', '阿树', '小鱼', 'Kevin', '七七'];
const juryRoles = [
  { name: '审判长', persona: '严肃但有点荒诞的法官，控制庭审节奏，会要求被告正面回答。' },
  { name: '检察官', persona: '尖锐、咄咄逼人，擅长抓被告话里的漏洞。' },
  { name: '辩护律师', persona: '站在被告一边，会把荒唐理由讲得像真的。' },
  { name: '关键证人', persona: '说话含糊，经常提供半真半假的现场细节。' },
  { name: '陪审员甲', persona: '普通网友风格，容易被情绪和细节影响。' },
  { name: '陪审员乙', persona: '理性怀疑派，不太相信任何人的说辞。' },
];
const juryCases = [
  '你被指控在公司群里偷偷把老板头像改成了表情包，并导致全员误发“收到”。',
  '你被指控把办公室最后一包速溶咖啡藏进抽屉，却声称那是“公共资源保护”。',
  '你被指控在朋友聚会点了最贵的菜，结账时突然研究起了优惠券。',
  '你被指控在小区群里冒充热心邻居，实际只是想打听谁家 Wi-Fi 最快。',
  '你被指控连续三天说“马上到”，但监控显示你每次都刚出门。',
  '你被指控把团队周报写得像悬疑小说，导致领导看完要求续集。',
];
const undercoverPairs = [
  ['牛奶', '豆浆'],
  ['火锅', '麻辣烫'],
  ['地铁', '高铁'],
  ['手机', '平板'],
  ['咖啡', '奶茶'],
  ['老师', '教练'],
  ['雨伞', '雨衣'],
  ['猫', '狗'],
  ['电影', '电视剧'],
  ['键盘', '鼠标'],
  ['电梯', '扶梯'],
  ['医生', '护士'],
  ['书包', '行李箱'],
  ['筷子', '勺子'],
  ['冰箱', '空调'],
  ['沙发', '床'],
  ['洗衣机', '烘干机'],
  ['牙刷', '梳子'],
  ['口红', '粉底'],
  ['耳机', '音箱'],
  ['眼镜', '隐形眼镜'],
  ['手表', '手环'],
  ['充电宝', '充电器'],
  ['电视', '显示器'],
  ['相机', '摄像机'],
  ['自行车', '电动车'],
  ['出租车', '网约车'],
  ['飞机', '轮船'],
  ['酒店', '民宿'],
  ['公园', '广场'],
  ['超市', '便利店'],
  ['商场', '菜市场'],
  ['图书馆', '书店'],
  ['医院', '药店'],
  ['学校', '培训班'],
  ['办公室', '会议室'],
  ['老板', '领导'],
  ['同事', '朋友'],
  ['学生', '家长'],
  ['保安', '警察'],
  ['厨师', '服务员'],
  ['演员', '歌手'],
  ['导演', '编剧'],
  ['外卖', '快递'],
  ['早餐', '夜宵'],
  ['米饭', '面条'],
  ['包子', '饺子'],
  ['蛋糕', '面包'],
  ['薯片', '饼干'],
  ['可乐', '雪碧'],
  ['啤酒', '红酒'],
  ['苹果', '梨'],
  ['西瓜', '哈密瓜'],
  ['鸡蛋', '鸭蛋'],
  ['牛排', '烤肉'],
  ['寿司', '饭团'],
  ['酸奶', '奶酪'],
  ['微信', '短信'],
  ['朋友圈', '微博'],
  ['直播', '短视频'],
  ['小说', '漫画'],
  ['篮球', '足球'],
  ['跑步', '散步'],
  ['游泳', '洗澡'],
  ['唱歌', '跳舞'],
  ['考试', '面试'],
  ['加班', '出差'],
  ['请假', '辞职'],
  ['红包', '转账'],
  ['密码', '验证码'],
  ['合同', '发票'],
  ['简历', '名片'],
  ['地图', '导航'],
  ['闹钟', '日历'],
  ['灯泡', '台灯'],
  ['窗帘', '百叶窗'],
  ['钥匙', '门禁卡'],
  ['钱包', '银行卡'],
  ['雨天', '雪天'],
  ['夏天', '冬天'],
  ['早晨', '晚上'],
  ['生日', '婚礼'],
  ['春节', '中秋'],
  ['礼物', '奖品'],
  ['照片', '画像'],
  ['耳环', '项链'],
  ['拖鞋', '运动鞋'],
  ['衬衫', '外套'],
  ['帽子', '围巾'],
  ['口罩', '墨镜'],
  ['打印机', '复印机'],
  ['白板', '黑板'],
  ['投影仪', '电视机'],
  ['胶水', '胶带'],
  ['铅笔', '圆珠笔'],
  ['作业', '报告'],
  ['椅子', '凳子'],
  ['楼梯', '坡道'],
  ['桥', '隧道'],
  ['湖', '海'],
  ['森林', '草原'],
  ['月亮', '太阳'],
];

const fallbackPairsByTier: Record<string, string[][]> = {
  obvious: [
    ['猫', '狗'],
    ['火锅', '麻辣烫'],
    ['手机', '平板'],
    ['雨伞', '雨衣'],
    ['键盘', '鼠标'],
    ['公交车', '出租车'],
    ['苹果', '香蕉'],
    ['篮球', '足球'],
    ['椅子', '桌子'],
    ['冰箱', '空调'],
    ['铅笔', '橡皮'],
    ['电视', '电脑'],
    ['鞋子', '袜子'],
    ['太阳', '月亮'],
    ['杯子', '碗'],
  ],
  close: [
    ['咖啡', '奶茶'],
    ['电梯', '扶梯'],
    ['酒店', '民宿'],
    ['老板', '领导'],
    ['耳机', '音箱'],
    ['地铁', '公交'],
    ['围巾', '帽子'],
    ['牙刷', '梳子'],
    ['书包', '行李箱'],
    ['充电宝', '充电器'],
    ['外套', '衬衫'],
    ['沙发', '床'],
    ['相机', '摄像机'],
    ['口红', '粉底'],
    ['手表', '手环'],
  ],
  contextual: [
    ['简历', '名片'],
    ['朋友圈', '微博'],
    ['会议室', '办公室'],
    ['合同', '发票'],
    ['外卖', '快递'],
    ['地图', '导航'],
    ['红包', '转账'],
    ['密码', '验证码'],
    ['直播', '短视频'],
    ['超市', '便利店'],
    ['图书馆', '书店'],
    ['早餐', '夜宵'],
    ['请假', '辞职'],
    ['考试', '面试'],
    ['医生', '护士'],
  ],
  abstract: [
    ['自由', '独立'],
    ['责任', '压力'],
    ['安全感', '信任'],
    ['体面', '尊严'],
    ['热闹', '陪伴'],
    ['效率', '质量'],
    ['耐心', '细心'],
    ['习惯', '自律'],
    ['公平', '规则'],
    ['惊喜', '期待'],
    ['勇气', '冲动'],
    ['安静', '孤独'],
    ['礼貌', '距离感'],
    ['稳定', '新鲜感'],
    ['目标', '方向'],
  ],
};
const undercoverAngles = [
  '外观或材质',
  '常见使用场景',
  '谁通常会用到它',
  '使用时的动作',
  '带来的感受',
  '容易出问题的地方',
  '和时间、季节或地点的关系',
  '价格、维护或消耗',
  '别人容易误会的一点',
  '一个很普通但具体的生活细节',
  '声音、气味、温度或触感',
  '不直接点破用途的抽象描述',
];
const npcReplies = [
  '还行吧，看情况',
  '我一般就随便刷刷',
  '这个有点难说',
  '没太想过这个',
  '差不多也是这样',
  '我可能会先看看大家怎么选',
  '有时候会，有时候不会',
  '主要看当天状态',
  '我身边好像挺多人这样',
  '别问，问就是睡觉',
  '我应该不会想那么多',
  '听着有点像我朋友',
  '这个我真不确定',
  '看起来都挺正常的',
  '我先观望一下',
];

export function pickPersona(index: number) {
  return personas[index % personas.length];
}

export function pickAiName(index: number, usedNames: Set<string>) {
  for (let i = 0; i < names.length; i++) {
    const name = names[(index + i) % names.length];
    if (!usedNames.has(name)) return name;
  }
  return `玩家${index + 1}`;
}

export async function getRoom(db: D1Database, roomId: string) {
  return db.prepare(`SELECT ${publicRoomFields} FROM ai_game_rooms WHERE id = ?`).bind(roomId).first();
}

export async function getPlayers(db: D1Database, roomId: string, reveal = false) {
  const fields = reveal
    ? 'id, room_id, user_id, display_name, player_type, secret_role, ai_persona, seat_index, is_online, last_seen_at, eliminated_at, created_at'
    : `id, room_id, display_name,
       CASE WHEN player_type = 'observer' THEN 'observer' ELSE NULL END as player_type,
       seat_index, is_online, last_seen_at, eliminated_at, created_at`;
  const result = await db.prepare(
    `SELECT ${fields} FROM ai_game_players WHERE room_id = ? ORDER BY seat_index ASC, created_at ASC`
  ).bind(roomId).all();
  return result.results || [];
}

export async function ensurePlayerHeartbeat(db: D1Database, playerId?: string) {
  if (!playerId) return;
  await db.prepare(
    `UPDATE ai_game_players SET last_seen_at = CURRENT_TIMESTAMP, is_online = 1 WHERE id = ?`
  ).bind(playerId).run();
}

export function normalizeGameMode(mode?: string) {
  if (mode === 'undercover' || mode === 'jury' || mode === 'solo' || mode === 'reverse' || mode === 'topic') return mode;
  return 'classic';
}

export function defaultsForMode(mode: string) {
  if (mode === 'undercover') return { maxPlayers: 6, aiCount: 5, durationSeconds: 240 };
  if (mode === 'jury') return { maxPlayers: 7, aiCount: 6, durationSeconds: 300 };
  if (mode === 'reverse') return { maxPlayers: 6, aiCount: 5, durationSeconds: 150 };
  if (mode === 'solo') return { maxPlayers: 6, aiCount: 2, durationSeconds: 180 };
  return { maxPlayers: 6, aiCount: 2, durationSeconds: 180 };
}

export function getJuryRoles() {
  return juryRoles;
}

export function pickJuryCase(roomId: string) {
  const seed = [...roomId].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return juryCases[seed % juryCases.length];
}

export function pickUndercoverPair(roomId: string) {
  return undercoverPairs[hashStringToIndex(roomId, undercoverPairs.length)];
}

function normalizeWordTier(tier?: string | null) {
  if (tier === 'obvious' || tier === 'close' || tier === 'contextual' || tier === 'abstract') return tier;
  return 'close';
}

function pickFallbackPair(seed: string, tier?: string | null) {
  const normalizedTier = normalizeWordTier(tier);
  const pairs = fallbackPairsByTier[normalizedTier] || undercoverPairs;
  return pairs[hashStringToIndex(`${normalizedTier}:${seed}`, pairs.length)] || pickUndercoverPair(seed);
}

function isSafeGeneratedWord(value: string) {
  const word = value.trim();
  if (!/^[\u4e00-\u9fa5]{2,4}$/.test(word)) return false;
  if (/政治|成人|色情|暴力|疾病|癌|药|品牌|公司|青团|汤圆|月饼|粽子|元宵|腊八/.test(word)) return false;
  return true;
}

function isSameWordVariant(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diffCount = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) diffCount++;
    if (diffCount > 1) return false;
  }
  return diffCount === 1;
}

export async function getDynamicUndercoverPair(db: D1Database, env: any, options: {
  roomId: string;
  tier?: string | null;
  seed?: string | null;
}) {
  const tier = normalizeWordTier(options.tier);
  const seed = options.seed || options.roomId;

  const usedMark = (row: any) => {
    if (!row?.id) return Promise.resolve();
    return db.prepare(
      `UPDATE ai_game_word_pairs SET used_count = used_count + 1, last_used_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(row.id).run();
  };

  const cached = await db.prepare(
    `SELECT * FROM ai_game_word_pairs
     WHERE tier = ? AND (last_used_at IS NULL OR last_used_at < datetime('now', '-30 minutes'))
     ORDER BY used_count ASC, ABS(RANDOM()) % 1000
     LIMIT 1`
  ).bind(tier).first();

  if (cached?.id && cached.civilian_word && cached.undercover_word) {
    await usedMark(cached);
    return [String(cached.civilian_word), String(cached.undercover_word)];
  }

  const generated = await generateAndCachePair(db, env, tier, seed);
  if (generated) return generated;

  const anyCached = await db.prepare(
    `SELECT * FROM ai_game_word_pairs
     WHERE tier = ?
     ORDER BY last_used_at ASC, used_count ASC
     LIMIT 1`
  ).bind(tier).first();

  if (anyCached?.id && anyCached.civilian_word && anyCached.undercover_word) {
    await usedMark(anyCached);
    return [String(anyCached.civilian_word), String(anyCached.undercover_word)];
  }

  return pickFallbackPair(seed, tier);
}

async function generateAndCachePair(db: D1Database, env: any, tier: string, seed: string): Promise<string[] | null> {
  try {
    const existing = await db.prepare(
      `SELECT civilian_word, undercover_word FROM ai_game_word_pairs WHERE tier = ?`
    ).bind(tier).all();
    const existingSet = new Set((existing.results || []).map((r: any) => `${r.civilian_word}|${r.undercover_word}`));
    const usedWords = new Set<string>();
    for (const r of (existing.results || [])) {
      usedWords.add(String(r.civilian_word));
      usedWords.add(String(r.undercover_word));
    }
    const avoidList = [...usedWords].slice(0, 20).join('、');

    const { config, apiKey } = getModel(env);
    const openai = new OpenAI({ apiKey, baseURL: config.baseURL });
    const avoidClause = avoidList
      ? `\n6. 以下词语已经用过，必须避开：${avoidList}`
      : '';
    const tierGuide: Record<string, string> = {
      obvious: '差异明显（如：猫/狗、火锅/麻辣烫、雨伞/雨衣）。两个词属于同一大类但一看就不同。',
      close: '非常接近但能通过细节区分（如：咖啡/奶茶、电梯/扶梯、酒店/民宿）。描述时容易混淆。',
      contextual: '在特定场景下才产生差异（如：外卖/快递、简历/名片、朋友圈/微博）。需要结合使用场景才能分辨。',
      abstract: '抽象概念（如：自由/独立、热闹/陪伴、体面/尊严）。需要深层理解和举例才能区分。',
    };
    const tierHint = tierGuide[tier] || tierGuide.close;
    const prompt = [
      '你是"谁是卧底"游戏的出词专家。生成一组适合中国大众玩家的词对。',
      '',
      `【当前难度】${tier}：${tierHint}`,
      '',
      '【硬性要求】',
      '1. 必须是2-4个汉字的日常高频词，中小学生都认识、都接触过。',
      '2. 两个词必须属于同一大类，生活中经常一起出现。',
      '3. 不能互相包含（如"手机/手机壳"），不能是同义词，不能是同一个词的简繁体变体（如"风筝/风箏"），不能一眼完全无关。',
      '4. 禁止：品牌名、人名、网络梗、地方小吃、节日食品、方言词、生僻词、专业术语。',
      '5. 好词对的标准：玩家一听就能聊，有生活细节可以描述，但又不至于一眼看穿。',
      '',
      '【好词对示范】',
      '牛奶/豆浆、地铁/高铁、外卖/快递、红包/转账、密码/验证码、耳机/音箱、',
      '早餐/夜宵、可乐/雪碧、篮球/足球、超市/便利店、图书馆/书店',
      '',
      '【反面教材（不要生成这类）】',
      '青团/汤圆 ❌ 节日食品、太冷门',
      '票据/凭证 ❌ 太书面、没人日常说',
      'VR/AR ❌ 英文缩写、不直观',
      '',
    ].join('\n') + (avoidClause ? `【已用词语，必须避开】\n${avoidList}\n\n` : '')
      + '只返回 JSON：{"civilianWord":"...","undercoverWord":"...","reason":"..."}';

    for (let attempt = 0; attempt < 2; attempt++) {
      const completion = await openai.chat.completions.create({
        model: config.model,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: `seed: ${seed}-attempt${attempt}-${crypto.randomUUID().slice(0, 6)}` },
        ],
        temperature: Math.min(1, 0.75 + attempt * 0.15 + (tier === 'abstract' ? 0.15 : 0)),
      });
      const raw = completion.choices[0]?.message?.content || '';
      const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || raw);
      const civilianWord = String(parsed.civilianWord || '').trim();
      const undercoverWord = String(parsed.undercoverWord || '').trim();
      if (
        isSafeGeneratedWord(civilianWord) &&
        isSafeGeneratedWord(undercoverWord) &&
        civilianWord !== undercoverWord &&
        !civilianWord.includes(undercoverWord) &&
        !undercoverWord.includes(civilianWord) &&
        !isSameWordVariant(civilianWord, undercoverWord) &&
        !usedWords.has(civilianWord) &&
        !usedWords.has(undercoverWord)
      ) {
        const pairKey = `${civilianWord}|${undercoverWord}`;
        if (!existingSet.has(pairKey)) {
          const id = `pair-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
          await db.prepare(
            `INSERT INTO ai_game_word_pairs
             (id, tier, civilian_word, undercover_word, reason, source, used_count, created_at, last_used_at)
             VALUES (?, ?, ?, ?, ?, 'generated', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
          ).bind(id, tier, civilianWord, undercoverWord, String(parsed.reason || '').slice(0, 160)).run();
        }
        return [civilianWord, undercoverWord];
      }
    }
  } catch (error) {
    console.warn('dynamic undercover pair fallback:', error);
  }
  return null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function encodeUndercoverMeta(role: 'civilian' | 'undercover', word: string, civilianWord: string, undercoverWord: string) {
  return `undercover|role=${role}|word=${word}|civilian=${civilianWord}|undercover=${undercoverWord}`;
}

export function parseUndercoverMeta(raw?: string | null) {
  if (!raw?.startsWith('undercover|')) return null;
  const parts = Object.fromEntries(raw.split('|').slice(1).map((part) => {
    const idx = part.indexOf('=');
    return idx >= 0 ? [part.slice(0, idx), part.slice(idx + 1)] : [part, ''];
  }));
  return {
    role: parts.role || '',
    word: parts.word || '',
    civilianWord: parts.civilian || '',
    undercoverWord: parts.undercover || '',
  };
}

export function generateNpcReply(player: any, messages: any[]) {
  const last = String(messages[messages.length - 1]?.content || '');
  const seed = [...`${player.id}:${messages.length}:${last}`].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const directQuestion = /吗|呢|咋|怎么|为什么|多少|哪|谁|\?|\？/.test(last);
  if (!directQuestion && seed % 4 === 0) return '';
  return npcReplies[seed % npcReplies.length];
}

function getModel(env: any) {
  const preferred = modelConfigs.find(config => config.model === 'qwen-plus') || modelConfigs[0];
  const apiKey = env[preferred.apiKey];
  if (!apiKey) throw new Error(`${preferred.model} 的API密钥未配置`);
  return { config: preferred, apiKey };
}

export async function generateAiGameReply(env: any, player: any, room: any, messages: any[]) {
  const { config, apiKey } = getModel(env);
  const openai = new OpenAI({ apiKey, baseURL: config.baseURL });
  const recent = messages.slice(-14).map((msg) => `${msg.sender_name}: ${msg.content}`).join('\n');
  const last = messages[messages.length - 1];
  const prompt = [
    '你正在参加一个“谁是 AI”的群聊游戏。',
    '你的目标不是表现聪明，而是像一个普通群友一样不显眼。',
    '你不能承认自己是 AI，也不能说自己是语言模型。',
    '回复必须短，通常 4 到 28 个中文字；最多不超过 45 个中文字。',
    '不要 Markdown，不要列表，不要括号补充，不要解释规则，不要总结。',
    '不要同时给出很多细节，不要编戏剧化经历，不要频繁用 emoji。',
    '不要每句话都完整回答；可以含糊、敷衍、反问、只接一句。',
    '像微信群普通人：低信息量、口语、平淡，不要像客服或助手。',
    '如果上一句不是问你，可以随便插一句，不需要正面回答。',
    `你在群里的名字是：${player.display_name}`,
    `你的人设是：${player.ai_persona || '普通网友'}`,
    `本局模式：${room.mode}`,
  ].join('\n');

  const completion = await openai.chat.completions.create({
    model: config.model,
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: `最近聊天记录：\n${recent}\n\n上一句是 ${last?.sender_name || '别人'} 说的：“${last?.content || ''}”。请以 ${player.display_name} 的身份随便回一句，别太像认真回答问题。` },
    ],
    temperature: 0.75,
  });

  const content = completion.choices[0]?.message?.content?.trim() || '我刚刚有点走神，你们继续说。';
  return content
    .replace(new RegExp(`^${player.display_name}[：:]\\s*`), '')
    .replace(/^(哈哈哈?|嗯嗯|确实|说实话|怎么说呢|我觉得)[，,、\s]*/i, '')
    .replace(/[。！？!]{2,}/g, (match) => match[0])
    .replace(/[\r\n]+/g, ' ')
    .replace(/[()[\]（）【】]/g, '')
    .trim()
    .slice(0, 80);
}

export async function generateJuryReply(env: any, player: any, room: any, messages: any[]) {
  const { config, apiKey } = getModel(env);
  const openai = new OpenAI({ apiKey, baseURL: config.baseURL });
  const caseText = pickJuryCase(room.id);
  const recent = messages.slice(-18).map((msg) => `${msg.sender_name}: ${msg.content}`).join('\n');
  const role = String(player.ai_persona || '');
  const prompt = [
    '你正在一个荒诞法庭游戏里扮演 AI 法庭角色。',
    '用户是真人被告。你的任务是推动庭审，不是提供法律建议。',
    '回复必须像群聊法庭发言，短、有戏剧张力，通常 20 到 80 个中文字。',
    '不要 Markdown，不要列表，不要讲真实法律条文，不要自称 AI。',
    '可以质询、反驳、帮腔、要求证据、吐槽，但不要替用户总结长篇内容。',
    `本案指控：${caseText}`,
    `你的名字：${player.display_name}`,
    `你的角色设定：${role}`,
  ].join('\n');

  const completion = await openai.chat.completions.create({
    model: config.model,
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: `庭审记录：\n${recent}\n\n请以 ${player.display_name} 的身份发言一句，推动庭审继续。` },
    ],
    temperature: 0.85,
  });

  return (completion.choices[0]?.message?.content?.trim() || '本庭需要被告继续说明。')
    .replace(new RegExp(`^${player.display_name}[：:]\\s*`), '')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, 180);
}

export async function generateUndercoverReply(env: any, player: any, room: any, messages: any[]) {
  const meta = parseUndercoverMeta(player.ai_persona);
  if (!meta) return '我先听听别人怎么说。';
  const { config, apiKey } = getModel(env);
  const openai = new OpenAI({ apiKey, baseURL: config.baseURL });
  const recent = messages.slice(-14).map((msg) => `${msg.sender_name}: ${msg.content}`).join('\n');
  const ownHistory = messages
    .filter((msg) => msg.player_id === player.id || msg.sender_name === player.display_name)
    .slice(-5)
    .map((msg) => msg.content)
    .join('\n');
  const ownTurnCount = messages.filter((msg) => msg.player_id === player.id || msg.sender_name === player.display_name).length;
  const seed = [...`${room.id}:${player.id}:${ownTurnCount}:${messages.length}`].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const angle = undercoverAngles[seed % undercoverAngles.length];
  const avoidAngles = undercoverAngles
    .filter((_, index) => index !== seed % undercoverAngles.length)
    .slice(ownTurnCount % 4, ownTurnCount % 4 + 3)
    .join('、');
  const prompt = [
    '你正在玩中文群聊游戏“谁是卧底”。',
    '你只能根据自己的词语做一轮描述，不能直接说出词语本身，也不能说同义替换得太明显。',
    '你的描述要短，像真人玩家，通常 10 到 35 个中文字。',
    '可以略微含糊，避免暴露自己；不要 Markdown，不要解释规则，不要自称 AI。',
    '不要写成文艺比喻、广告语或谜语，像普通人在群里随口描述。',
    '必须避开最近发言里已经出现过的描述角度和词句，不能复读别人。',
    '不要使用模板化句式，例如“上课时老师常把它连到投影仪上”这类固定说法。',
    '不要每次都说学校、老师、投影、上班、家里这些高频场景，除非指定角度要求。',
    `本轮你的描述角度：${angle}`,
    `尽量避开的角度：${avoidAngles}`,
    `你的名字：${player.display_name}`,
    `你的词语：${meta.word}`,
    `你的身份：${meta.role === 'undercover' ? '卧底' : '平民'}`,
  ].join('\n');

  try {
    const completion = await openai.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `最近发言：\n${recent || '暂无'}\n\n你自己之前说过：\n${ownHistory || '暂无'}\n\n请按“${angle}”发一条新的描述，不能出现“${meta.word}”这几个字，也不要复用自己以前的句式。` },
      ],
      temperature: 0.95,
      presence_penalty: 0.6,
      frequency_penalty: 0.5,
    });

    return (completion.choices[0]?.message?.content?.trim() || '这个东西挺常见的，大家应该都接触过。')
      .replace(new RegExp(escapeRegExp(meta.word), 'g'), '这个东西')
      .replace(new RegExp(`^${player.display_name}[：:]\\s*`), '')
      .replace(/[\r\n]+/g, ' ')
      .trim()
      .slice(0, 90);
  } catch (error) {
    console.warn('undercover ai reply fallback:', error);
    return generateUndercoverFallbackReply({
      playerId: player.id,
      word: meta.word,
      messageCount: messages.length,
      ownTurnCount,
    });
  }
}

export async function generateUndercoverVote(env: any, voter: any, players: any[], messages: any[]) {
  const voterMeta = parseUndercoverMeta(voter.ai_persona);
  const candidates = players
    .filter((player) => player.id !== voter.id && player.player_type !== 'observer' && !player.eliminated_at)
    .map((player) => player.display_name);
  if (candidates.length === 0) return null;

  try {
    const { config, apiKey } = getModel(env);
    const openai = new OpenAI({ apiKey, baseURL: config.baseURL });
    const transcript = messages
      .filter((msg) => msg.sender_type !== 'system')
      .map((msg) => `${msg.sender_name}: ${msg.content}`)
      .join('\n')
      .slice(-5000);
    const prompt = [
      '你正在玩“谁是卧底”，现在必须投票。',
      '你只能从候选名单里选一个人。',
      '如果你是平民，投你认为最像卧底的人。',
      '如果你是卧底，投一个平民背锅，避免自己被投出。',
      '只返回一个候选玩家名字，不要解释。',
      `你的名字：${voter.display_name}`,
      `你的词语：${voterMeta?.word || ''}`,
      `你的身份：${voterMeta?.role === 'undercover' ? '卧底' : '平民'}`,
      `候选名单：${candidates.join('、')}`,
    ].join('\n');
    const completion = await openai.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `聊天记录：\n${transcript}\n\n你投谁？只返回名字。` },
      ],
      temperature: 0.4,
    });
    const raw = completion.choices[0]?.message?.content?.trim() || '';
    const matched = players.find((player) => player.id !== voter.id && !player.eliminated_at && raw.includes(player.display_name));
    if (matched) return matched;
  } catch {}

  const seed = [...`${voter.id}:${messages.map((msg) => msg.content).join('|')}`].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const fallback = players.filter((player) => player.id !== voter.id && player.player_type !== 'observer' && !player.eliminated_at);
  return fallback[seed % fallback.length] || null;
}

export async function generateAiGameSummary(env: any, room: any, players: any[], messages: any[], votes: any[]) {
  try {
    const { config, apiKey } = getModel(env);
    const openai = new OpenAI({ apiKey, baseURL: config.baseURL });
    const transcript = messages.map((msg) => `${msg.sender_name}: ${msg.content}`).join('\n').slice(-5000);
    const voteText = votes.map((vote) => `${vote.voter_name || vote.voter_player_id} 投给 ${vote.target_name || vote.target_player_id}`).join('\n');
    const isJury = room.mode === 'jury';
    const isUndercover = room.mode === 'undercover';
    const roleText = players.map((p) => {
      const meta = isUndercover ? parseUndercoverMeta(p.ai_persona) : null;
      return meta
        ? `${p.display_name}: ${meta.role === 'undercover' ? '卧底' : '平民'}，词语=${meta.word}`
        : `${p.display_name}: ${p.secret_role}`;
    }).join('\n');
    const completion = await openai.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: isJury
            ? '你是荒诞法庭游戏的审判长。请生成中文判决书摘要和适合分享的一句话。判决可以是无罪、警告、社区服务、赔咖啡等轻喜剧结果。返回 JSON，字段 summary 和 shareText。'
            : isUndercover
              ? '你是“谁是卧底”游戏主持人。请根据玩家身份、投票和发言生成最终结算，不要说进入下一轮。说明谁是卧底、平民词和卧底词、玩家是否投中。返回 JSON，字段 summary 和 shareText。'
            : '你是“谁是 AI”游戏裁判。请用中文生成简短复盘和适合分享的一句话。返回 JSON，字段 summary 和 shareText。'
        },
        { role: 'user', content: isJury ? `本案指控：${pickJuryCase(room.id)}\n\n庭审记录：\n${transcript}` : `身份：\n${roleText}\n\n投票：\n${voteText}\n\n聊天：\n${transcript}` },
      ],
      temperature: 0.7,
    });
    const raw = completion.choices[0]?.message?.content || '';
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || raw);
    return {
      summary: String(parsed.summary || '').slice(0, 500),
      shareText: String(parsed.shareText || '').slice(0, 160),
    };
  } catch {
    return {
      summary: '这局已经揭晓，看看你有没有识破隐藏在群聊里的 AI。',
      shareText: '我刚玩了一局“谁是 AI”，来看看你能不能猜中。',
    };
  }
}
