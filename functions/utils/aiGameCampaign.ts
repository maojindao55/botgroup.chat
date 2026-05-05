export type CampaignWordTier = 'obvious' | 'close' | 'contextual' | 'abstract';

const campaignTitlePrefix = '卧底晋级赛';
const validWordTiers = new Set<CampaignWordTier>(['obvious', 'close', 'contextual', 'abstract']);

export function normalizeCampaignWordTier(value?: string | null): CampaignWordTier | null {
  if (validWordTiers.has(value as CampaignWordTier)) return value as CampaignWordTier;
  return null;
}

export function sanitizeCampaignTitle(title?: string | null) {
  return String(title || '').replace(/\s*\[tier:[^\]]+\]/, '').trim();
}

export function isCampaignRoom(room: any) {
  if (room?.mode !== 'undercover') return false;
  if (Number(room?.campaign_level) > 0) return true;
  return sanitizeCampaignTitle(room?.title).startsWith(campaignTitlePrefix);
}

export function resolveCampaignWordTier(room: any): CampaignWordTier {
  const storedTier = normalizeCampaignWordTier(String(room?.word_tier || ''));
  if (storedTier) return storedTier;

  const titleTier = String(room?.title || '').match(/\[tier:([\w-]+)\]/)?.[1] || '';
  return normalizeCampaignWordTier(titleTier) || 'close';
}
