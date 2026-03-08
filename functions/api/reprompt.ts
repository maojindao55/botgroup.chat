import { generateAICharacters } from '../../src/config/aiCharacters';
import { groups } from '../../src/config/groups';

export async function onRequestGet(context) {
  try {
    const groupIndex = context.request.url.includes('?id=') 
      ? parseInt(context.request.url.split('?id=')[1]) 
      : 0;

    const group = groups[groupIndex];
    if (!group) {
      throw new Error('群组不存在');
    }

    const characters = generateAICharacters(group.name, '#allTags#')
      .filter(character => group.members.includes(character.id))
      .filter(character => character.personality !== "sheduler");

    const reprompts = characters.map(character => ({
      id: character.id,
      reprompt: character.custom_prompt.replace('#groupName#', group.name) + "\n" + group.description
    }));

    return Response.json({
      code: 200,
      data: reprompts
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
} 