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
