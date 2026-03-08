import {generateAICharacters } from '../../src/config/aiCharacters';
import { groups } from '../../src/config/groups';
export async function onRequestGet(context) {
    try {
      const db = context.env.bgdb;
      const userId = context.data?.user?.userId;
      let dynamicGroups = [];

      if (db && userId) {
        const result = await db.prepare(
          `SELECT g.id, g.name, g.description, g.created_by, g.created_at
           FROM claw_groups g
           INNER JOIN claw_group_users gu ON g.id = gu.group_id
           WHERE gu.user_id = ?
           ORDER BY gu.joined_at ASC`
        ).bind(userId).all();

        dynamicGroups = (result.results || []).map((g) => ({
          id: g.id,
          name: `🦞${g.name}`,
          description: g.description || '',
          members: [],
          isGroupDiscussionMode: true,
          type: 'openclaw',
          clawGroupId: g.id
        }));
      }

      const allGroups = [...groups, ...dynamicGroups];

      return Response.json({
        code: 200,
        data: {
          groups: allGroups,
          characters: generateAICharacters('#groupName#', '#allTags#'),
          user: context.data.user || null
        }
      });
    } catch (error) {
      console.error(error);
      return Response.json(
        { error: error.message },
        { status: 500 }
      );
    }
  }
