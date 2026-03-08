import { modelConfigs, generateAICharacters } from '../../src/config/aiCharacters';
import OpenAI from 'openai';

interface AICharacter {
  id: string;
  name: string;
  tags?: string[];
}

interface MessageHistory {
  role: string;
  content: string;
  name: string;
}

interface AIResponse {
  id: string;
  reprompt?: string;
}

export async function onRequestPost({ env, request }) {
  console.log('scheduler');
  try {
    const { message, history, availableAIs, state } = await request.json();
    const selectedAIs = await scheduleAIResponses(message, history, availableAIs, env, state);

    return Response.json({
      responses: selectedAIs
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

async function analyzeMessageWithAI(message: string, allTags: string[], env: any, history: MessageHistory[] = []): Promise<string[]> {
    const shedulerAI = generateAICharacters(message, allTags.join(','))[0];
    const modelConfig = modelConfigs.find(config => config.model === shedulerAI.model);
    const apiKey = env[modelConfig.apiKey];
    if (!apiKey) {
      throw new Error(`${modelConfig.model} 的API密钥未配置`);
    }
    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: modelConfig.baseURL,
    });

    const prompt = shedulerAI.custom_prompt;

    try {
      const completion = await openai.chat.completions.create({
        model: shedulerAI.model,
        messages: [
          { role: "user", content: prompt },
          ...history.slice(-10), // 添加历史消息
          { role: "user", content: message }
        ],
      });

      const matchedTags = completion.choices[0].message.content?.split(',').map(tag => tag.trim()) || [];
      return matchedTags;
    } catch (error) {
      console.error('AI分析失败:', error.message);
      return [];
    }
}

async function scheduleAIResponses(
  message: string, 
  history: MessageHistory[], 
  availableAIs: AICharacter[],
  env: any,
  state: any
): Promise<AIResponse[]> {
  switch (state) {
    case 'start':
      // 在开始状态
      return [{
        id: 'ai1',
        reprompt: `你是一个谁是卧底游戏主持人，请分配两个词语，用逗号分隔，不要有任何前缀。`
      },
      {
        id: 'ai2',
        reprompt: `你是一个谁是卧底游戏主持人，请分配两个词语，用逗号分隔，不要有任何前缀。`
      },
    ];
      
    case 'word_description':
      // 分析消息并返回匹配的AI
      const matchedTags = await analyzeMessageWithAI(message, availableAIs.flatMap(ai => ai.tags || []), env, history);
      return availableAIs
        .filter(ai => ai.tags?.some(tag => matchedTags.includes(tag)))
        .map(ai => ({
          id: ai.id,
          reprompt: `基于${matchedTags.join(', ')}标签匹配`
        }));
      
    case 'schedule':
      // 在调度状态，为每个AI生成特定的reprompt
      return availableAIs.map(ai => ({
        id: ai.id,
        reprompt: `请以${ai.name}的身份回复这条消息`
      }));
      
    default:
      return [];
  }
} 