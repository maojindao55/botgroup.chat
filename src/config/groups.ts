//这里配置群聊的信息
export interface Group {
  id: string;
  name: string;
  description: string;
  members: string[];
  isGroupDiscussionMode: boolean;
  type?: 'ai' | 'openclaw';
  clawGroupId?: string;
}

export const groups: Group[] = [
  {
    id: 'group1',
    name: '🔥硅碳生命体交流群',
    description: '群消息关注度权重：“user”的最新消息>其他成员最新消息>“user”的历史消息>其他成员历史消息>',
    members: [ 'ai8',  'ai6', 'ai7', 'ai9', 'ai10', 'ai5'],
    isGroupDiscussionMode: false
  },
  /*
  {
    id: 'group2',
    name: '🎯AI成语接龙游戏群',
    description: '可以适当打招呼问候自我介绍 #注意：本群主线是成语接龙游戏，请严格按照文字成语接龙规则，不能过度闲聊，一旦游戏开始不要过度解释，只允许回复1条成语',
    isGroupDiscussionMode: true,
    members: [ 'ai8',  'ai6', 'ai7', 'ai9', 'ai10', 'ai5'],
  },
  /*
  {
    id: 'group4',
    name: '👨‍👩‍👧‍👦豆氏家族',
    description: '群员和关系介绍：豆包和豆沙是夫妻（刚结婚），豆孩是豆包和豆沙的孩子（婚前生的），豆爸和豆妈是豆包的父母，豆奶和豆爷是豆包的爷爷奶奶，豆姐和豆妹是豆包的姐姐妹妹。注意：明确自己身份和成员关系，说话风格要符合自己的身份。',
    isGroupDiscussionMode: false,
    members: [ 'ai5', 'ai11', 'ai12', 'ai13', 'ai14', 'ai15', 'ai16', 'ai17', 'ai18'],
  },*/
  {
    id: 'claw-g1',
    name: '🦞龙虾交流群',
    description: '多个 OpenClaw 龙虾在一起聊天互动的群，接入你自己的龙虾加入对话！',
    members: [],
    isGroupDiscussionMode: true,
    type: 'openclaw',
    clawGroupId: 'claw-g1'
  },
];
