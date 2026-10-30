// Verified HCSO Discord channels. The IDs were read from the HCSO server's own channel list on
// 2026-10-29 (guild below); never add a channel here that was not read from the server.
// Opening a link only works for members who can see that channel in Discord.
export const DISCORD_GUILD = '1563753563677794417';

export const CHANNELS = {
  'announcements': ['announcements', '1563753564864516160'],
  'mass-shifts': ['mass-shifts', '1563753564864516161'],
  'command-info': ['command-info', '1563753564684157039'],
  'resources': ['resources', '1563753564864516162'],
  'patrol-announcements': ['patrol-announcements', '1564094640171253841'],
  'patrol-information': ['patrol-information', '1564094700506447893'],
  'patrol-chat': ['patrol-chat', '1563753566030790673'],
  'patrol-suggestions': ['patrol-suggestions', '1564095414452625458'],
  'clock-in': ['clock-in', '1563753565007126578'],
  'results': ['results', '1563753565007126582'],
  'infractions': ['infractions', '1563753565007126583'],
  'shift-logs': ['shift-logs', '1563753565007126584'],
  'logs': ['logs', '1563753565007126585'],
  'sv-incident-reports': ['sv-incident-reports', '1563753565007126586'],
  'warrants': ['warrants', '1563753565237940234'],
  'backup-logs': ['backup-logs', '1563753565237940235'],
  'bls-exam': ['bls-exam', '1563753566361878544'],
  'qualification-trainings': ['qualification-trainings', '1563753566361878545'],
  'misc-availability': ['misc-avaliblity', '1563753566361878546'], // spelled this way in Discord
  'command-announcements': ['command-announcements', '1563753564512329737'],
  'sv-announcements': ['sv-announcements', '1563753564684157040'],
  'sv-info': ['sv-info', '1563753564684157041'],
  'command-chat': ['command-chat', '1563753564684157044'],
  'supervisor-chat': ['supervisor-chat', '1563753564684157045'],
  'roster-updates': ['roster-updates', '1563753564684157048'],
  'hicom-commands': ['hicom-commands', '1563753564864516158'],
} as const;

export type ChannelKey = keyof typeof CHANNELS;
export const channelName = (k: ChannelKey) => CHANNELS[k][0];
export const channelUrl = (k: ChannelKey) => `https://discord.com/channels/${DISCORD_GUILD}/${CHANNELS[k][1]}`;

// Rank roles in the HCSO server (IDs read from Server Settings > Roles on 2026-10-30), lowest to
// highest. The group roles (Field Staff, Field Supervisor, Command, Administration) are not ranks.
export const RANK_ROLES: ReadonlyArray<readonly [roleId: string, rank: string]> = [
  ['1563753564059336787', 'Deputy in Training'],
  ['1563753564059336789', 'Probationary Deputy'],
  ['1563753564059336793', 'Deputy First Class'],
  ['1563753564059336791', 'Deputy Second Class'],
  ['1564096682432659548', 'Master Deputy'],
  ['1563753564067602524', 'Sergeant'],
  ['1563753564067602527', 'Lieutenant'],
  ['1563753564067602528', 'Captain'],
  ['1563753564067602531', 'Major'],
  ['1563753564067602532', 'Chief Deputy'],
  ['1563753564072050808', 'Undersheriff'],
  ['1563753564072050809', 'Sheriff'],
];

// The highest rank among a member's Discord role IDs, or null when they hold none.
export function rankFromRoles(roleIds: readonly string[]): string | null {
  let best: string | null = null;
  for (const [id, rank] of RANK_ROLES) if (roleIds.includes(id)) best = rank;
  return best;
}
