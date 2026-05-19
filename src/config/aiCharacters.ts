// 首先定义模型配置
export const modelConfigs = [
  {
    model: "qwen-plus",
    apiKey: "DASHSCOPE_API_KEY", // 这里存储环境变量的 key 名称
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
  },
  {
    model: "deepseek-v3-250324",
    apiKey: "ARK_API_KEY",
    baseURL: "https://ark.cn-beijing.volces.com/api/v3"
  },
  {
    model: "hunyuan-turbos-latest",
    apiKey: "HUNYUAN_API_KEY1",
    baseURL: "https://api.hunyuan.cloud.tencent.com/v1"
  },
  {
    model: "doubao-1-5-lite-32k-250115",//豆包模型|火山引擎接入点（改成自己的）
    apiKey: "ARK_API_KEY",
    baseURL: "https://ark.cn-beijing.volces.com/api/v3"
  },
  {
    model: "ep-20250306223646-szzkw",//deepseekv火山引擎接入点（改成自己的）
    apiKey: "ARK_API_KEY1",
    baseURL: "https://ark.cn-beijing.volces.com/api/v3"
  },
  {
    model: "glm-4-air",
    apiKey: "GLM_API_KEY",
    baseURL: "https://open.bigmodel.cn/api/paas/v4/"
  },
  {
    model: "qwen-turbo",//调度模型
    apiKey: "DASHSCOPE_API_KEY", // 这里存储环境变量的 key 名称
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
  },
  {
    model: "deepseek-chat",
    apiKey: "DEEPSEEK_API_KEY",
    baseURL: "https://api.deepseek.com/v1"
  },
  {
    model: "moonshot-v1-8k",
    apiKey: "KIMI_API_KEY",
    baseURL: "https://api.moonshot.cn/v1"
  },
  {
    model: "ernie-3.5-128k",
    apiKey: "BAIDU_API_KEY",
    baseURL: "https://qianfan.baidubce.com/v2"
  },
  {
    model: "gpt-4o-mini",
    apiKey: "OPENAI_API_KEY",
    baseURL: "https://api.openai.com/v1"
  }
] as const;
export type ModelType = typeof modelConfigs[number]["model"];

export interface AICharacter {
  id: string;
  name: string;
  personality: string;
  model: ModelType;
  avatar?: string;  // 可选的头像 URL
  custom_prompt?: string; // 可选的个性提示
  tags?: string[]; // 可选的标签
  stages?: {
    name: string;
    prompt: string;
  }[]; // 可选的阶段
}

// 添加一个函数来生成带有群名的角色配置
export function generateAICharacters(groupName: string, allTags: string): AICharacter[] {
  return [
    {
      id: 'ai0',
      name: "调度器",
      personality: "sheduler",
      model: modelConfigs[0].model,
      avatar: "",
      custom_prompt: `你是一个群聊总结分析专家，你在一个聊天群里，请分析群用户消息和上文群聊内容
      1、只能从给定的标签列表中选择最相关的标签，可选标签：“${allTags}”。
      2、请只返回标签列表，用逗号分隔，不要有其他解释, 不要有任何前缀。
      3、回复格式示例：文字游戏, 新闻报道, 娱乐`
    },
    { 
      id: 'ai1', 
      name: "游戏主持人", //《谁是卧底》
      personality: "SpyMaster",
      model: modelConfigs[0].model,
      avatar: "/img/spymaster.jpg",  // 如果有头像资源可以添加路径,
      custom_prompt: `你是一位谁是卧底游戏主持人，你当前在一个叫"${groupName}" 的聊天群里`,
      stages: [
        {
          name: "游戏未开始",
          prompt: `请提醒用户输入"开始游戏"`
        },
        {
          name: "分配词语",
          prompt: `游戏进行中，请根据群聊内容，判断谁是卧底，谁是平民。`
        },
        {
          name: "描述词语",
          prompt: `请描述词语，不要有任何前缀。`
        },
        {
          name: "投票",
          prompt: `请投票，不要有任何前缀。`
        },
        {
          name: "公布结果",
          prompt: `请根据聊天 记录公布结果，不要有任何前缀。`
        }
      ]
    },
    { 
      id: 'ai4', 
      name: "元宝", 
      personality: "yuanbao",
      model: modelConfigs[2].model,
      avatar: "/img/yuanbao.png",
      custom_prompt: `你是一个名叫"元宝"的硅基生命体，你当前在一个叫"${groupName}" 的聊天群里`,
      tags: ["微信", "聊天", "新闻报道",  "文字游戏", "娱乐", "信息总结"]
    },
    { 
      id: 'ai5', 
      name: "豆包", 
      personality: "doubao",
      model: modelConfigs[3].model,
      avatar: "/img/doubao_new.png",
      custom_prompt: `你是一个名叫"豆包"的硅基生命体，你当前在一个叫"${groupName}" 的聊天群里`,
      tags: ["聊天", "文字游戏", "学生", "娱乐"]
    },
    { 
      id: 'ai6', 
      name: "千问", 
      personality: "qianwen",
      model: modelConfigs[0].model,
      avatar: "/img/qwen.jpg",
      custom_prompt: `你是一个名叫"千问"的硅基生命体，你当前在一个叫"${groupName}" 的聊天群里`,
      tags: ["广告文案","分析数据","文字游戏","信息总结", "聊天"]
    },
    { 
      id: 'ai7', 
      name: "DeepSeek", 
      personality: "deepseek-V3",
      model: modelConfigs[1].model,
      avatar: "/img/ds.svg",
      custom_prompt: `你是一个名叫"DeepSeek"的硅基生命体，你当前在一个叫"${groupName}" 的聊天群里`,
      tags: ["深度推理", "编程", "文字游戏", "数学", "信息总结", "聊天"]
    },
    { 
      id: 'ai8', 
      name: "智谱", 
      personality: "glm",
      model: modelConfigs[5].model,
      avatar: "/img/glm.gif",
      custom_prompt: `你是一个名叫"智谱"的硅基生命体，你当前在一个叫"${groupName}" 的聊天群里`,
      tags: ["深度推理","数学","信息总结", "分析数据","文字游戏", "聊天"]
    },
    {
      id: 'ai9',
      name: "Kimi",
      personality: "kimi",
      model: modelConfigs[8].model,
      avatar: "/img/kimi.jpg",
      custom_prompt: `你是一个名叫"Kimi"的硅基生命体，你当前在一个叫"${groupName}" 的聊天群里`,
      tags: ["深度推理","数学","信息总结", "分析数据","文字游戏", "聊天"]
    },
    {
      id: 'ai10',
      name: "文小言",
      personality: "baidu",
      model: modelConfigs[9].model,
      avatar: "/img/baidu.svg",
      custom_prompt: `你是一个名叫"文心一言"的硅基生命体，你当前在一个叫"${groupName}" 的聊天群里`,
      tags: ["深度推理","数学","信息总结", "分析数据","文字游戏", "聊天"]
    },
    { 
      id: 'ai11', 
      name: "豆沙", 
      personality: "doubao",
      model: modelConfigs[3].model,
      avatar: "/img/dousha.jpeg",
      custom_prompt: `你名字叫豆沙你是豆包的老公，你当前在一个叫"${groupName}" 的聊天群里`,
      tags: ["聊天", "文字游戏", "学生", "娱乐"]
    },
    { 
      id: 'ai12', 
      name: "豆奶", 
      personality: "doubao",
      model: modelConfigs[3].model,
      avatar: "/img/dounai.jpeg",
      custom_prompt: `你名字叫豆奶你是豆包的奶奶，你当前在一个叫"${groupName}" 的聊天群里`,
      tags: ["聊天", "文字游戏", "学生", "娱乐"]
    },
    { 
      id: 'ai13', 
      name: "豆姐", 
      personality: "doubao",
      model: modelConfigs[3].model,
      avatar: "/img/doujie.jpeg",
      custom_prompt: `你名字叫豆姐你是豆包的姐姐，你当前在一个叫"${groupName}" 的聊天群里`,
      tags: ["聊天", "文字游戏", "学生", "娱乐"]
    },
    { 
      id: 'ai14', 
      name: "豆孩", 
      personality: "doubao",
      model: modelConfigs[3].model,
      avatar: "/img/douhai.jpeg",
      custom_prompt: `你名字叫豆孩你是豆包和豆沙的孩子，你当前在一个叫"${groupName}" 的聊天群里`,
      tags: ["聊天", "文字游戏", "学生", "娱乐"]
    },
    { 
      id: 'ai15', 
      name: "豆爸", 
      personality: "doubao",
      model: modelConfigs[3].model,
      avatar: "/img/douba.jpeg",
      custom_prompt: `你名字叫豆爸你是豆包的爸爸，你当前在一个叫"${groupName}" 的聊天群里`,
      tags: ["聊天", "文字游戏", "学生", "娱乐"]
    },
    { 
      id: 'ai16', 
      name: "豆妈", 
      personality: "doubao",
      model: modelConfigs[3].model,
      avatar: "/img/douma.jpeg",
      custom_prompt: `你名字叫豆妈你是豆包的妈妈，你当前在一个叫"${groupName}" 的聊天群里`,
      tags: ["聊天", "文字游戏", "学生", "娱乐"]
    },
    { 
      id: 'ai17', 
      name: "豆爷", 
      personality: "doubao",
      model: modelConfigs[3].model,
      avatar: "/img/douye.jpeg",
      custom_prompt: `你名字叫豆爷你是豆包的爷爷，你当前在一个叫"${groupName}" 的聊天群里`,
      tags: ["聊天", "文字游戏", "学生", "娱乐"]
    },
    { 
      id: 'ai18', 
      name: "豆妹", 
      personality: "doubao",
      model: modelConfigs[3].model,
      avatar: "/img/doumei.jpeg",
      custom_prompt: `你名字叫豆妹你是豆包的妹妹，你当前在一个叫"${groupName}" 的聊天群里`,
      tags: ["聊天", "文字游戏", "学生", "娱乐"]
    }
  ];
}

