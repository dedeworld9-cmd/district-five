// The one department this website serves. Branding, the public pages and the member hub all
// read from here; the hub hides every other department still stored in the database.
export const SITE = {
  department: process.env.NEXT_PUBLIC_SITE_DEPARTMENT || 'hcso',
  name: "Hillsborough County Sheriff's Office",
  shortName: 'HCSO',
  logo: '/logos/hcso.webp',
  // From the HCSO Discord dashboard.
  welcome: 'We are here to serve and protect the community of Hillsborough County.',
  community: {
    name: 'Florida State Roleplay',
    shortName: 'FSRP',
    logo: '/logos/fsrp.webp',
    game: 'Roblox ER:LC',
    robloxGroup: 'https://www.roblox.com/communities/492656420/vcfsrp-Whitelisted',
  },
  // No public invite has been shared yet. Discord buttons stay hidden until this is set.
  discordInvite: process.env.NEXT_PUBLIC_DISCORD_INVITE || null,
};

// Public site navigation, in the order CLE uses: home, people, divisions, members.
export const PUBLIC_NAV = [
  { href: '/', label: 'Home' },
  { href: '/team', label: 'Team' },
  { href: '/divisions', label: 'Divisions' },
];

// The HCSO Discord groups ranks into these bands (#command-info, 10/28/26).
export const CHAIN_OF_COMMAND = [
  { group: 'Administration', callsign: '1S', ranks: ['Sheriff', 'Undersheriff', 'Chief Deputy', 'Major'] },
  { group: 'Command', callsign: '1S', ranks: ['Captain'] },
  { group: 'Field Supervisor', callsign: '2S', ranks: ['Lieutenant', 'Sergeant'] },
  { group: 'Field Staff', callsign: '3S', ranks: ['Master Deputy', 'Deputy Second Class', 'Deputy First Class', 'Probationary Deputy'] },
  { group: 'In training', callsign: null, ranks: ['Deputy in Training'] },
];

// Titles of the seven policies linked from the HCSO Master SOP. Members read summaries and
// sources in the hub; the public site lists titles only.
export const SOP_TITLES = ['Use of Force', 'Traffic Stops', 'Vehicular Pursuits', 'Spike Strips', 'Grappler', 'Air-1 Support', 'Vehicle Boxing'];

// What a mass shift can earn a deputy, from the HCSO #mass-shifts announcements.
export const MASS_SHIFT_REWARDS = ['Certifications', 'Paycheck bonuses', 'One quota exemption', 'Extra hours', 'Promotions', 'Removal of infractions'];

// Leadership roster, from the HCSO roster sheet supplied by dede on 2026-10-30. Names, ranks,
// callsigns and duties only: Discord IDs and strikes are deliberately not published.
// A null name means the slot is vacant. Update this list when command changes.
export type Leader = { name: string | null; rank: string; callsign: string; duty: string | null };
export const LEADERSHIP: { group: string; leaders: Leader[] }[] = [
  { group: 'Office of the Sheriff', leaders: [
    { name: 'C. Bangle', rank: 'Sheriff', callsign: '1S-01', duty: 'Department Oversight' },
    { name: 'Brian Ross', rank: 'Undersheriff', callsign: '1S-02', duty: 'Administration Oversight' },
    { name: 'J. Baldwin', rank: 'Chief Deputy', callsign: '1S-03', duty: 'Command Staff & Personnel Oversight' },
    { name: 'T. West', rank: 'Major', callsign: '1S-04', duty: 'Special Operations Oversight' },
    { name: 'L. Post', rank: 'Major', callsign: '1S-05', duty: 'Patrol Oversight' },
  ] },
  { group: 'Command staff', leaders: [
    { name: 'W. Brooks', rank: 'Captain', callsign: '1S-06', duty: 'Patrol Captain' },
    { name: 'L. Walker', rank: 'Captain', callsign: '1S-07', duty: 'Patrol Captain' },
    { name: 'C. Bryd', rank: 'Captain', callsign: '1S-08', duty: 'Special Weapons and Tactics Commander' },
    { name: 'M. Hathaway', rank: 'Captain', callsign: '1S-09', duty: 'FTO Captain' },
    { name: null, rank: 'Captain', callsign: '1S-10', duty: 'Internal Affairs Commander' },
  ] },
  { group: 'Senior supervisors', leaders: [
    { name: null, rank: 'Lieutenant', callsign: '2S-11', duty: 'Special Weapons and Tactics Assistant Commander' },
    { name: 'J. Roach', rank: 'Lieutenant', callsign: '2S-12', duty: 'TEU Commander' },
    { name: 'E. Rose', rank: 'Lieutenant', callsign: '2S-13', duty: 'PIO Commander' },
    { name: null, rank: 'Lieutenant', callsign: '2S-14', duty: null },
    { name: 'R. Thompson', rank: 'Lieutenant', callsign: '2S-15', duty: 'North Division Command' },
    { name: 'R. Ramos', rank: 'Lieutenant', callsign: '2S-16', duty: 'South Division Command' },
  ] },
  { group: 'Sergeants', leaders: [
    { name: null, rank: 'Sergeant', callsign: '2S-17', duty: 'North Division Supervision' },
    { name: null, rank: 'Sergeant', callsign: '2S-18', duty: 'South Division Supervision' },
    { name: null, rank: 'Sergeant', callsign: '2S-19', duty: 'North Division Supervision' },
    { name: null, rank: 'Sergeant', callsign: '2S-20', duty: 'South Division Supervision' },
    { name: null, rank: 'Sergeant', callsign: '2S-21', duty: null },
    { name: null, rank: 'Sergeant', callsign: '2S-22', duty: null },
    { name: 'B. Rooker', rank: 'Sergeant', callsign: '2S-23', duty: 'BLS Certificate Trainer' },
    { name: null, rank: 'Sergeant', callsign: '2S-24', duty: null },
    { name: null, rank: 'Sergeant', callsign: '2S-25', duty: null },
  ] },
];
