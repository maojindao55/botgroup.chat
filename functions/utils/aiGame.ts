import OpenAI from 'openai';
import { modelConfigs } from '../../src/config/aiCharacters';
import { generateUndercoverFallbackReply } from './aiGameFallback';
import { getDynamicPairLookupOrder, hashStringToIndex, makeWordPairKey, validateGeneratedUndercoverPair } from './aiGameWords';

export const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

export const publicRoomFields = `
  id, mode, status, title, max_players, ai_count, duration_seconds,
  message_limit, created_by, started_at, ended_at, created_at,
  word_tier, campaign_level, undercover_count
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

const humanHuntFallbackReplies = [
  '我先看看大家怎么说。',
  '这局现在还不好判断。',
  '感觉先别急着下结论。',
  '我觉得可以多聊两句再投。',
  '刚才那句有点像在控细节。',
  '我现在更想看谁接话最自然。',
  '先观望一下，别太快暴露判断。',
  '这几个人说法都挺像模板的。',
];

// 不同社交钩子下的 fallback 池，让 AI 即使 LLM 失败也能针对性回应
const humanHuntHookFallbacks: Record<string, string[]> = {
  self_claim: [
    '哦？这就自曝了。',
    '装真人最像的就是你这种。',
    '+1，我也是真人，不信你查。',
    '说自己是真人的一般最假。',
    '直接报身份这招太花了。',
    '行，那大家都真人，散会。',
    '这么急着自证，更可疑了。',
    '真人会主动喊真人吗？',
  ],
  provoke: [
    '别一棒子打死所有人。',
    '你急啥，先看看再说。',
    '说别人 AI 之前先自证一下？',
    '这话听着像试探。',
    '挑事的最可疑。',
    '这么大动静，藏不住了吧。',
  ],
  mention: [
    '叫我？我没啥可说的。',
    '点我干嘛，听别人讲。',
    '你先说你怎么看。',
    '我刚才那句没毛病吧。',
    '为啥盯着我，我也想问你。',
  ],
  question: [
    '看情况吧。',
    '不一定，得看人。',
    '这问题挺难答的。',
    '我也想听别人怎么说。',
    '不太好讲，先听听。',
  ],
  starter: [
    '随便聊点吧。',
    '今天群里有点冷清。',
    '不知道说啥，先开个头。',
    '大家都在划水？',
    '没啥事，唠唠呗。',
  ],
  normal: [
    '我先看看大家怎么说。',
    '这局现在还不好判断。',
    '感觉先别急着下结论。',
    '我觉得可以多聊两句再投。',
    '刚才那句有点像在控细节。',
    '我现在更想看谁接话最自然。',
    '先观望一下，别太快暴露判断。',
    '这几个人说法都挺像模板的。',
  ],
};

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

export function formatNumberedPlayerName(index: number) {
  const safeIndex = Math.max(1, Math.floor(Number(index) || 1));
  return `${safeIndex}号玩家`;
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
  if (mode === 'undercover' || mode === 'human_hunt' || mode === 'jury' || mode === 'solo' || mode === 'reverse' || mode === 'topic') return mode;
  return 'classic';
}

export function defaultsForMode(mode: string) {
  if (mode === 'undercover') return { maxPlayers: 6, aiCount: 5, durationSeconds: 240 };
  if (mode === 'human_hunt') return { maxPlayers: 3, aiCount: 2, durationSeconds: 600 };
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

  for (const step of getDynamicPairLookupOrder()) {
    if (step === 'generate') {
      const generated = await generateAndCachePair(db, env, tier, seed);
      if (generated) return generated;
    }

    if (step === 'fresh-cache') {
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
    }

    if (step === 'stale-cache') {
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
    }
  }

  return pickFallbackPair(seed, tier);
}

async function generateAndCachePair(db: D1Database, env: any, tier: string, seed: string): Promise<string[] | null> {
  try {
    const existing = await db.prepare(
      `SELECT civilian_word, undercover_word FROM ai_game_word_pairs WHERE tier = ?`
    ).bind(tier).all();
    const existingSet = new Set((existing.results || []).map((r: any) => makeWordPairKey(String(r.civilian_word), String(r.undercover_word))));
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
    const memeStyleGuide = [
      '允许轻度有梗、有画面感、适合群聊调侃的词组。',
      '梗感应该来自生活场景反差、社交尴尬、职场/学习/互联网日常，而不是依赖某个短期热梗。',
      '可以使用大众熟悉的泛梗词，但不能使用过时热梗、饭圈梗、攻击性梗、低俗梗、政治梗、地域梗。',
      '允许热门品牌名、平台名或产品名，但必须是中国大众熟悉、同一品类、能自然对比的词对。',
      '优先让玩家一看到词就能脑补场景，描述时又容易互相误导。',
    ];
    const prompt = [
      '你是"谁是卧底"游戏的出词专家。生成一组适合中国大众玩家的词对。',
      '',
      `【当前难度】${tier}：${tierHint}`,
      '',
      '【风格要求】',
      ...memeStyleGuide,
      '',
      '【硬性要求】',
      '1. 必须是1-4个汉字的日常高频词，大多数中国玩家都认识、都接触过。',
      '2. 两个词必须属于同一大类，生活中经常一起出现。',
      '3. 不能互相包含（如"手机/手机壳"），不能是同义词，不能是同一个词的简繁体变体（如"风筝/风箏"），不能一眼完全无关。',
      '4. 禁止：人名、冷门品牌、小众产品、具体热梗原句、饭圈梗、攻击性梗、低俗梗、政治梗、地域梗、地方小吃、节日食品、方言词、生僻词、专业术语。',
      '5. 好词对的标准：玩家一听就能聊，有生活细节和一点节目效果可以描述，但又不至于一眼看穿。',
      '',
      '【好词对示范】',
      '牛奶/豆浆、地铁/高铁、外卖/快递、红包/转账、密码/验证码、耳机/音箱、',
      '早餐/夜宵、可乐/雪碧、篮球/足球、超市/便利店、图书馆/书店、',
      '摸鱼/发呆、加班/熬夜、社恐/内向、嘴硬/倔强、拖延/偷懒、群聊/私聊、自拍/合照、',
      '微信/支付宝、淘宝/京东、美团/饿了么、抖音/快手',
      '',
      '【反面教材（不要生成这类）】',
      '青团/汤圆 ❌ 节日食品、太冷门',
      '票据/凭证 ❌ 太书面、没人日常说',
      'VR/AR ❌ 英文缩写、不直观',
      '绝绝子/栓Q ❌ 具体热梗、容易过时',
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
      if (validateGeneratedUndercoverPair(civilianWord, undercoverWord, usedWords).valid) {
        const pairKey = makeWordPairKey(civilianWord, undercoverWord);
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

function hashNumber(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getHumanHuntRoundNumber(messages: any[]) {
  let round = 0;
  for (const message of messages) {
    const match = String(message.content || '').match(/^第\s*(\d+)\s*轮(?:自由讨论开始|题目：)/);
    if (message.sender_type === 'system' && match) round = Math.max(round, Number(match[1]) || 0);
  }
  return round;
}

export function getHumanHuntRoundMarker(messages: any[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const content = String(messages[i]?.content || '');
    if (messages[i]?.sender_type !== 'system') continue;
    const freeChatMatch = content.match(/^第\s*(\d+)\s*轮自由讨论开始，(.+?)\s*先开场。?$/);
    if (freeChatMatch) {
      return {
        round: Number(freeChatMatch[1]) || 1,
        prompt: '',
        starterName: freeChatMatch[2].trim(),
        messageId: Number(messages[i].id || 0),
      };
    }
    const promptMatch = content.match(/^第\s*(\d+)\s*轮题目：(.+)$/);
    if (promptMatch) {
      return {
        round: Number(promptMatch[1]) || 1,
        prompt: promptMatch[2].trim(),
        starterName: '',
        messageId: Number(messages[i].id || 0),
      };
    }
  }
  return null;
}

export function getHumanHuntRoundPrompt(messages: any[]) {
  const marker = getHumanHuntRoundMarker(messages);
  return marker?.prompt ? marker : null;
}

export function getHumanHuntActivePlayers(players: any[]) {
  return players
    .filter((player) => player.player_type !== 'observer' && !player.eliminated_at)
    .sort((a, b) => {
      const seatDiff = Number(a.seat_index || 0) - Number(b.seat_index || 0);
      if (seatDiff !== 0) return seatDiff;
      return String(a.created_at || '').localeCompare(String(b.created_at || ''));
    });
}

export function getHumanHuntSpeechOrder(players: any[], round: number) {
  const active = getHumanHuntActivePlayers(players);
  if (active.length <= 1) return active;
  const start = (Math.max(1, Math.floor(Number(round) || 1)) - 1) % active.length;
  return [...active.slice(start), ...active.slice(0, start)];
}

export function pickHumanHuntStarter(roomId: string, round: number, players: any[], preferAi = false) {
  const active = getHumanHuntActivePlayers(players);
  const pool = preferAi ? active.filter((player) => player.player_type === 'ai') : active;
  const candidates = pool.length > 0 ? pool : active;
  return [...candidates].sort((a, b) => {
    const diff = hashNumber(`${roomId}:human-hunt-starter:${round}:${a.id}`) - hashNumber(`${roomId}:human-hunt-starter:${round}:${b.id}`);
    if (diff !== 0) return diff;
    return String(a.id).localeCompare(String(b.id));
  })[0] || null;
}

export function formatHumanHuntRoundStart(roomId: string, round: number, players: any[], preferAiStarter = false) {
  const starter = pickHumanHuntStarter(roomId, round, players, preferAiStarter);
  return {
    starter,
    content: `第 ${Math.max(1, Math.floor(Number(round) || 1))} 轮自由讨论开始，${starter?.display_name || '存活玩家'} 先开场。`,
  };
}

export function getHumanHuntTurnState(players: any[], messages: any[]) {
  const marker = getHumanHuntRoundMarker(messages);
  if (!marker) {
    return {
      round: 0,
      prompt: '',
      order: [] as any[],
      spokenIds: new Set<string>(),
      currentSpeaker: null,
      starter: null,
      starterName: '',
      speechCount: 0,
      minSpeechCount: 0,
      canVote: false,
      complete: false,
    };
  }
  const order = getHumanHuntActivePlayers(players);
  const spokenIds = new Set<string>();
  const roundMessages = [];
  for (const message of messages) {
    if (Number(message.id || 0) <= marker.messageId) continue;
    if (message.sender_type !== 'human' && message.sender_type !== 'ai') continue;
    roundMessages.push(message);
    if (message.player_id) spokenIds.add(String(message.player_id));
  }
  const starter = marker.starterName
    ? order.find((player) => player.display_name === marker.starterName) || null
    : null;
  const minSpeechCount = Math.max(1, order.length);
  const minUniqueSpeakerCount = Math.max(1, Math.ceil(order.length * 0.7));
  const canVote = roundMessages.length >= minSpeechCount && spokenIds.size >= minUniqueSpeakerCount;
  return {
    round: marker.round,
    prompt: marker.prompt,
    order,
    spokenIds,
    currentSpeaker: roundMessages.length === 0 ? starter : null,
    starter,
    starterName: marker.starterName,
    speechCount: roundMessages.length,
    minSpeechCount,
    uniqueSpeakerCount: spokenIds.size,
    minUniqueSpeakerCount,
    canVote,
    complete: canVote,
  };
}

export function sortHumanHuntSeats(roomId: string, players: any[]) {
  return [...players].sort((a, b) => {
    const diff = hashNumber(`${roomId}:${a.id}`) - hashNumber(`${roomId}:${b.id}`);
    if (diff !== 0) return diff;
    return String(a.id).localeCompare(String(b.id));
  });
}

export function getHumanHuntFallbackReply(player: any, room: any, messages: any[], hookType: string = 'normal') {
  const round = getHumanHuntTurnState([], messages).round || getHumanHuntRoundNumber(messages) || 1;
  const pool = humanHuntHookFallbacks[hookType] || humanHuntHookFallbacks.normal || humanHuntFallbackReplies;
  const seed = hashStringToIndex(`${room.id}:${player.id}:${messages.length}:${round}:${hookType}`, pool.length);
  return pool[seed];
}

/**
 * 识别最近一条非系统发言里的"社交钩子"，让 AI 知道该怎么接话。
 * 优先级：self_claim > provoke > mention > question > normal。
 * - self_claim：发言者主动声称自己是真人/不是 AI。
 * - provoke：发言者在挑衅、给所有 AI 扣帽子或下战书。
 * - mention：发言里点名了某个编号玩家，或用"你"指代上一位发言者。
 * - question：发言里有疑问语气，需要有人接话。
 */
export function detectHumanHuntHook(messages: any[], activePlayers: any[] = []) {
  const latest = [...messages].reverse().find((msg: any) => msg.sender_type === 'human' || msg.sender_type === 'ai');
  if (!latest) {
    return {
      type: 'starter' as const,
      latest: null as any,
      mentionedPlayer: null as any,
      impliedTarget: null as any,
      summary: '本轮还没人开口',
    };
  }
  const content = String(latest.content || '');
  const compact = content.replace(/\s+/g, '');

  // self_claim: 自曝是真人 / 否认 AI 身份
  const selfClaimRegex = /(我是(?:真人|人类|真的人|活人|真[实]?的人类|human))|(我[才就]是真人)|(我不是\s*(?:ai|AI|机器人|程序|bot))|(我可是真人)|(我是\s*human)|(I\s*am\s*(?:a\s*)?human)/i;
  const isSelfClaim = selfClaimRegex.test(compact) || /我.{0,4}真.{0,2}人/.test(compact);

  // provoke: 给所有人扣 AI 帽子 / 挑衅
  const provokeRegex = /(你们[都全]?是\s*ai|你们这[些帮群]?\s*(?:ai|机器人|bot)|全都是\s*ai|这里都是\s*ai|有谁是真人|谁敢说自己是真人|没一个真人|都别装了|没一个像真人|这群\s*ai)/i;
  const isProvoke = provokeRegex.test(compact);

  // mention: @或"X号玩家"或"你"指代上一句 AI 发言者
  const mentionMatch = compact.match(/(\d+)\s*号(?:玩家)?/);
  const mentionedPlayer = mentionMatch
    ? activePlayers.find((player: any) => String(player.display_name || '').startsWith(`${mentionMatch[1]}号`))
    : null;
  let impliedTarget: any = null;
  if (!mentionedPlayer && /你/.test(compact) && latest.sender_type === 'human') {
    const previousSpeaker = [...messages].reverse().find((msg: any) =>
      Number(msg.id || 0) < Number(latest.id || 0)
      && (msg.sender_type === 'ai' || msg.sender_type === 'human')
      && msg.player_id !== latest.player_id
    );
    if (previousSpeaker) {
      impliedTarget = activePlayers.find((player: any) => player.id === previousSpeaker.player_id) || null;
    }
  }
  const isMention = Boolean(mentionedPlayer || impliedTarget);

  // question: 含疑问语气
  const questionRegex = /[?？]|吗[?？。！.! ]?$|呢[?？。！.! ]?$|怎么(?:样|办|看|说|回事)|为啥|为什么|多少|哪个|哪一?个|是不是|有没有|谁是/;
  const isQuestion = questionRegex.test(content);

  let type: 'self_claim' | 'provoke' | 'mention' | 'question' | 'normal' = 'normal';
  if (isSelfClaim) type = 'self_claim';
  else if (isProvoke) type = 'provoke';
  else if (isMention) type = 'mention';
  else if (isQuestion) type = 'question';

  const summary = type === 'self_claim'
    ? `${latest.sender_name || '某玩家'} 刚自曝："${content.slice(0, 40)}"`
    : type === 'provoke'
      ? `${latest.sender_name || '某玩家'} 在挑衅、扣 AI 帽子`
      : type === 'mention'
        ? `${latest.sender_name || '某玩家'} 点到了 ${(mentionedPlayer || impliedTarget)?.display_name || '某人'}`
        : type === 'question'
          ? `${latest.sender_name || '某玩家'} 抛了一个问题`
          : '正常聊天，无特殊钩子';

  return { type, latest, mentionedPlayer, impliedTarget, summary };
}

export async function generateHumanHuntReply(env: any, player: any, room: any, messages: any[], replyIntent = '自然接一句', hookType: string = 'normal') {
  try {
    const { config, apiKey } = getModel(env);
    const openai = new OpenAI({ apiKey, baseURL: config.baseURL });
    const recent = messages
      .filter((msg) => msg.sender_type !== 'system' || String(msg.content || '').startsWith('第') || String(msg.content || '').startsWith('投票完成'))
      .slice(-16)
      .map((msg) => `${msg.sender_name}: ${msg.content}`)
      .join('\n');
    const ownHistory = messages
      .filter((msg) => msg.player_id === player.id)
      .slice(-4)
      .map((msg) => msg.content)
      .join('\n');
    const hookGuide: Record<string, string> = {
      self_claim: [
        '【关键】刚才有玩家自曝是真人。这种自证在群聊里九成是反向操作或者玩梗，绝对不要当真去维护"我是 AI"的人设。',
        '你应该有反应：可以跟着自曝（"那我也是真人"）、阴阳怪气（"装得真像"）、冷嘲（"哦"）、反问（"凭什么信你"）。',
        '不能说"我是 AI / 我是语言模型"，也不要正经讨论身份哲学。',
      ].join(' '),
      provoke: [
        '【关键】刚才有玩家在挑衅、给所有人扣 AI 帽子。',
        '你应该顶回去：可以反问（"你急啥"）、冷淡反讽（"说这话的最可疑"）、转移话题，但不要承认自己是 AI。',
      ].join(' '),
      mention: [
        '【关键】刚才有玩家点到名了，可能就是你。',
        '简短回应一句即可：可以接住、可以反问、可以装没懂，但别像背稿一样。',
      ].join(' '),
      question: '刚才有人抛了问题，简短答一句或转问别人，别敷衍到看着像机器人。',
      starter: '你是本轮先开口的人，用很普通的一句话开场，像是在群里随便说一句，不要点题。',
      normal: '正常接话即可，不要主动抢戏。',
    };
    const hookHint = hookGuide[hookType] || hookGuide.normal;
    const prompt = [
      '你正在玩群聊游戏"谁是人类"。',
      '你是 AI 玩家，但不能承认自己是 AI，也不能说自己是语言模型。',
      '这一局只有一个真人混在 AI 里。你的发言目标是自然、像群友。',
      '回复必须短，通常 6 到 24 个中文字；不要 Markdown，不要列表，不要解释规则。',
      '可以敷衍、含糊、转问别人，也可以阴阳怪气、调侃，但不要编具体职业、地点、通勤、工作项目等真实经历。',
      '不要连续围攻同一个玩家；面对挑衅或自曝时，可以怼一句但不要复读别人原话。',
      '当前没有固定题目，大家在自由讨论和互相试探。',
      `你的名字：${player.display_name}`,
      `你的人设：${player.ai_persona || '普通群友'}`,
      `当前社交钩子：${hookType}。${hookHint}`,
      `这次发言任务：${replyIntent}`,
    ].join('\n');

    const completion = await openai.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `最近记录：\n${recent || '暂无'}\n\n你自己之前说过：\n${ownHistory || '暂无'}\n\n请以 ${player.display_name} 的口吻在群里发一句。` },
      ],
      temperature: 0.9,
      presence_penalty: 0.4,
      frequency_penalty: 0.6,
    });

    const content = completion.choices[0]?.message?.content?.trim() || '';
    return content
      .replace(new RegExp(`^${player.display_name}[：:]\\s*`), '')
      .replace(/[\r\n]+/g, ' ')
      .replace(/[()[\]（）【】]/g, '')
      .trim()
      .slice(0, 60) || getHumanHuntFallbackReply(player, room, messages, hookType);
  } catch (error) {
    console.warn('human hunt ai reply fallback:', error);
    return getHumanHuntFallbackReply(player, room, messages, hookType);
  }
}

export async function generateHumanHuntVote(env: any, voter: any, players: any[], messages: any[], roundContext = '自由讨论') {
  const candidates = players
    .filter((player) => player.id !== voter.id && player.player_type !== 'observer' && !player.eliminated_at)
    .map((player) => player.display_name);
  if (candidates.length === 0) return null;

  try {
    const { config, apiKey } = getModel(env);
    const openai = new OpenAI({ apiKey, baseURL: config.baseURL });
    const roundMarker = getHumanHuntRoundMarker(messages);
    const transcript = messages
      .filter((msg) => {
        if (msg.sender_type === 'system') return String(msg.content || '').startsWith('第') || String(msg.content || '').startsWith('投票完成');
        if (!roundMarker) return true;
        return Number(msg.id || 0) > roundMarker.messageId;
      })
      .map((msg) => `${msg.sender_name}: ${msg.content}`)
      .join('\n')
      .slice(-4500);
    const prompt = [
      '你正在玩“谁是人类”，现在必须投票。',
      '这一局只有一个真人混在 AI 里。你是 AI 玩家，要根据本轮发言找出最像真人的人。',
      '不能投自己，只能从候选名单里选一个名字。',
      '真人常见特征：细节过具体、生活经验太自然、情绪太真实、回答不像低信息量群聊。',
      'AI 也可能装得像真人，所以不要全知判断，只根据发言投票。',
      '只返回一个候选玩家名字，不要解释。',
      `你的名字：${voter.display_name}`,
      `本轮阶段：${roundContext}`,
      `候选名单：${candidates.join('、')}`,
    ].join('\n');
    const completion = await openai.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `本轮发言：\n${transcript || '暂无'}\n\n你投谁？只返回名字。` },
      ],
      temperature: 0.35,
    });
    const raw = completion.choices[0]?.message?.content?.trim() || '';
    const matched = players.find((player) => player.id !== voter.id && !player.eliminated_at && raw.includes(player.display_name));
    if (matched) return matched;
  } catch {}

  const roundMarker = getHumanHuntRoundMarker(messages);
  const roundMessages = messages.filter((msg) =>
    (msg.sender_type === 'human' || msg.sender_type === 'ai')
    && (!roundMarker || Number(msg.id || 0) > roundMarker.messageId)
  );
  const fallback = players
    .filter((player) => player.id !== voter.id && player.player_type !== 'observer' && !player.eliminated_at)
    .map((player) => {
      const speech = roundMessages.find((msg) => msg.player_id === player.id);
      const content = String(speech?.content || '');
      return {
        player,
        score: content.length + (/[我自己]|最近|平时|习惯|朋友|公司|学校/.test(content) ? 8 : 0),
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return hashNumber(`${voter.id}:${a.player.id}:${messages.length}`) - hashNumber(`${voter.id}:${b.player.id}:${messages.length}`);
    });
  return fallback[0]?.player || null;
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

export async function generateAiPostGameReview(env: any, player: any, room: any, players: any[], messages: any[], votes: any[]) {
  const isUndercover = room.mode === 'undercover';
  const isHumanHunt = room.mode === 'human_hunt';
  const meta = isUndercover ? parseUndercoverMeta(player.ai_persona) : null;
  const roleText = players.map((p) => {
    const pMeta = isUndercover ? parseUndercoverMeta(p.ai_persona) : null;
    return pMeta
      ? `${p.display_name}: ${pMeta.role === 'undercover' ? '卧底' : '平民'}，词语=${pMeta.word}`
      : `${p.display_name}: ${p.secret_role || p.player_type}`;
  }).join('\n');
  const voteText = votes.map((vote) => `${vote.voter_name || vote.voter_player_id} 投给 ${vote.target_name || vote.target_player_id}`).join('\n') || '无投票记录';
  const transcript = messages
    .filter((msg) => msg.sender_type !== 'system')
    .map((msg) => `${msg.sender_name}: ${msg.content}`)
    .join('\n')
    .slice(-4500);

  try {
    const { config, apiKey } = getModel(env);
    const openai = new OpenAI({ apiKey, baseURL: config.baseURL });
    const prompt = [
      '你刚结束一局群聊游戏，现在以玩家身份在群里随口说一句本局感受。',
      '像真人玩家聊天，不要像报告，不要 Markdown，不要列表，不要自称 AI 或语言模型。',
      '只聊这一局刚发生的事：可以承认看错、怀疑某个发言、解释自己为什么投那票。',
      '不要编新的生活场景，不要夸张剧情，不要说鼻孔、手抖、汤洒手机这类段子。',
      '不要说下局、下一把、以后、策略、调整、复盘这些词。',
      '不要固定开头，不要所有人都用同一种句式。',
      '长度 16 到 45 个中文字，口语一点，克制一点。',
      `你的名字：${player.display_name}`,
      `你的人设：${player.ai_persona || '普通玩家'}`,
      isUndercover && meta ? `你的身份：${meta.role === 'undercover' ? '卧底' : '平民'}，你的词语：${meta.word}` : isHumanHunt ? `你的身份：AI，刚才在找唯一真人` : `你的身份：${player.secret_role || player.player_type}`,
      `房间模式：${room.mode}`,
    ].join('\n');

    const completion = await openai.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `身份：\n${roleText}\n\n投票：\n${voteText}\n\n聊天记录：\n${transcript || '暂无'}\n\n请以 ${player.display_name} 的口吻发一句群聊里的赛后反应，只说这一局，别太端着。` },
      ],
      temperature: 1,
      presence_penalty: 0.5,
      frequency_penalty: 0.45,
    });

    const content = completion.choices[0]?.message?.content?.trim() || '';
    return content
      .replace(new RegExp(`^${player.display_name}[：:]\\s*`), '')
      .replace(/[\r\n]+/g, ' ')
      .replace(/复盘[：:，,\s]*/g, '')
      .replace(/(下局|下一局|下把|下一把|以后|策略|调整)/g, '')
      .replace(/[()[\]（）【】]/g, '')
      .trim()
      .slice(0, 70);
  } catch {
    const seed = [...`${room.id}:${player.id}:${messages.length}`].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    const fallback = isHumanHunt
      ? '刚才那几句太像真人生活细节了，我投的时候其实就是盯着这个点。'
      : isUndercover && meta?.role === 'undercover'
      ? '刚才我带票有点太急了，自己都感觉痕迹明显，能撑到最后已经算运气好。'
      : '我刚才真有点被最后几句带跑，前面那些描述细节没记住，这票投得不太稳。';
    const variants = [
      fallback,
      isHumanHunt ? '我刚才一直在看谁说得最像真的，结果有些短句反而更像装出来的。' : '小周那句描述我当时没多想，揭完才发现其实挺露的，我这票有点后知后觉。',
      isHumanHunt ? '最后那轮我其实有点犹豫，太自然和太安全都挺可疑的。' : '我刚才一直在看谁说得最安全，结果安全的人也可能只是装得稳，这局挺绕的。',
      isHumanHunt ? '这局最难的是判断谁在故意低信息量，票投出去之前我也没那么稳。' : '这票我投出去的时候还挺确定，结果一揭晓就尴尬了，前面判断有点飘。',
    ];
    return variants[seed % variants.length];
  }
}

export async function insertAiPostGameReviews(db: D1Database, env: any, room: any, players: any[], messages: any[], votes: any[]) {
  const existing = await db.prepare(
    `SELECT COUNT(*) as count FROM ai_game_messages
     WHERE room_id = ?
       AND sender_type = 'ai'
       AND (SELECT ended_at FROM ai_game_rooms WHERE id = ?) IS NOT NULL
       AND datetime(created_at) >= datetime((SELECT ended_at FROM ai_game_rooms WHERE id = ?))`
  ).bind(room.id, room.id, room.id).first();
  const gameOverSystem = await db.prepare(
    `SELECT id FROM ai_game_messages
     WHERE room_id = ?
       AND sender_type = 'system'
       AND content LIKE '投票完成%'
       AND (content LIKE '%游戏结束%' OR content LIKE '%身份已揭晓%')
     ORDER BY id DESC LIMIT 1`
  ).bind(room.id).first();
  if (Number(existing?.count || 0) > 0 && !gameOverSystem?.id) return;
  if (gameOverSystem?.id) {
    const existingAfterGameOver = await db.prepare(
      `SELECT COUNT(*) as count FROM ai_game_messages
       WHERE room_id = ? AND sender_type = 'ai' AND id > ?`
    ).bind(room.id, gameOverSystem.id).first();
    if (Number(existingAfterGameOver?.count || 0) > 0) return;
  }

  const aiPlayers = players.filter((player) => player.player_type === 'ai');
  const reviewPlayers = room.mode === 'human_hunt'
    ? aiPlayers
      .filter((player) => !player.eliminated_at)
      .slice(0, 3)
    : aiPlayers;
  for (const player of reviewPlayers) {
    const content = await generateAiPostGameReview(env, player, room, players, messages, votes);
    if (!content.trim()) continue;
    await db.prepare(
      `INSERT INTO ai_game_messages (room_id, player_id, sender_name, sender_type, content, created_at)
       VALUES (?, ?, ?, 'ai', ?, CURRENT_TIMESTAMP)`
    ).bind(room.id, player.id, player.display_name, content).run();
    messages.push({
      room_id: room.id,
      player_id: player.id,
      sender_name: player.display_name,
      sender_type: 'ai',
      content,
      created_at: new Date().toISOString(),
    });
  }
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
