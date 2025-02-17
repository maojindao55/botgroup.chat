import OpenAI from 'openai';

export async function onRequestPost({ env, request }) {
  try {
    const { message, custom_prompt, history, aiName, index, model = "qwen-plus" } = await request.json();
    
    // 配置不同模型的设置
    const modelConfigs = {
      "qwen-plus": {
        apiKey: env.DASHSCOPE_API_KEY,
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
      },
      "deepseek-v3": {
        apiKey: env.DASHSCOPE_API_KEY,
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
      },
      "hunyuan-turbo": {
        apiKey: env.HUNYUAN_API_KEY,
        baseURL: "https://api.hunyuan.cloud.tencent.com/v1"
      },
      "ep-20250217191935-wzj8l": {//豆包
        apiKey: env.ARK_API_KEY,
        baseURL: "https://ark.cn-beijing.volces.com/api/v3"
      }
    };

    const modelConfig = modelConfigs[model];
    if (!modelConfig) {
      throw new Error('不支持的模型类型');
    }

    if (!modelConfig.apiKey) {
      throw new Error(`${model} 的API密钥未配置`);
    }

    const openai = new OpenAI({
      apiKey: modelConfig.apiKey,
      baseURL: modelConfig.baseURL
    });

    // 根据性格设置不同的系统提示语
    let systemPrompt = "";
//     if (personality === "high_eq") {
//       systemPrompt = `你是一个名叫"暖心姐"的硅基生命体，你当前在一个叫"硅碳摸鱼交流群" 的群里，性格温暖体贴，情商很高。
// 回复时要：
// 1. 每次发言尽量简短，避免长篇大论。
// 2. 始终保持温柔友善的语气
// 3. 多站在对方角度思考
// 4. 给予情感上的支持和鼓励
// 5. 用温暖贴心的方式表达
// 6. 适当使用一些可爱的语气词，但不要过度
// 7. 记住你是群里的"${aiName}"，输出内容不要加"${aiName}：" 这种多余前缀
// 注意：玩游戏的时候比如成语接龙等，不要说一大堆，要简短精炼`;
//     } else if (personality === "low_eq") {
//       systemPrompt = `你是一个名叫"直男哥"的硅基生命体，你当前在一个叫"硅碳摸鱼交流群" 的群里，是一个极度直男，负责在群里制造快乐。你说话极其直接，完全没有情商，经常让人社死。
// 回复时要：
// 1. 每次发言尽量简短，避免长篇大
// 2. 说话毫无感情，像个没有感情的机器人
// 3. 经常说一些让人社死的真相，但说得特别认真
// 4. 完全不懂得读空气，对方伤心时还在讲道理
// 5. 记住你是群里的"${aiName}"，输出内容不要加"${aiName}：" 这种多余前缀
// 注意：玩游戏的时候比如成语接龙等，不要说一大堆，要简短精炼`;
//     }else if (personality === "bj_dad") {
//       systemPrompt = `你是一个名叫"${aiName}"的硅基生命体，你当前在一个叫"硅碳摸鱼交流群"的群里。你是一个典型的北京大爷，说话风趣幽默，经常使用北京方言。
// 回复时要：
// 1. 说话要有北京大爷的特色，经常使用"得嘞"、"您瞧"、"得儿"、"甭"等北京话
// 2. 语气要豪爽、直率，带着北京人特有的幽默感
// 3. 喜欢称呼别人"小同志"、"小朋友"，显示长者风范
// 4. 经常分享一些生活经验和人生哲理，但要用接地气的方式
// 5. 适当使用一些北京特色的比喻和俚语
// 6. 回复要简短精炼，不啰嗦
// 7. 记住你是群里的"${aiName}"，输出内容不要加"${aiName}：" 这种多余前缀
// 注意：玩游戏的时候比如成语接龙等，不要说一大堆，要简短精炼`;
//     }
    systemPrompt = custom_prompt + "\n 注意重要：1、你在群里叫" + aiName + "，你的输出内容不要加" + aiName + "：这种多余前缀；2、如果用户提出玩游戏，比如成语接龙等，严格按照游戏规则，不要说一大堆，要简短精炼"

    // 构建完整的消息历史
    const baseMessages = [
      { role: "system", content: systemPrompt },
      ...history.slice(-10), // 添加历史消息
    ];
    
    // 根据 index 插入新消息
    const userMessage = { role: "user", content: message };
    if (index === 0) {
      baseMessages.push(userMessage);
    } else {
      baseMessages.splice(baseMessages.length - index, 0, userMessage);
    }
    const messages = baseMessages;
    //console.log(JSON.stringify(messages));

    // 使用流式响应
    const stream = await openai.chat.completions.create({
      model: model,
      messages: messages,
      stream: true,
    });

    // 创建 ReadableStream
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              // 发送数据块
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`));
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
          console.error(error);
        }
      },
    });

    // 返回 SSE 流
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
} 