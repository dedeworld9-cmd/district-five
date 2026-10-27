// Department uniform, fleet and weapon standards, transcribed from each department's own
// portal. Pictures are served from that portal until copies are added under public/.
import sahpUniforms from '@/content/sahp/uniforms.json';
import sahpVehicles from '@/content/sahp/vehicles.json';
import sahpWeapons from '@/content/sahp/weapons.json';
import bcsoUniforms from '@/content/bcso/uniforms.json';

export type SpecSection = { h: string; items: (string | [string, string])[] };
export interface EquipmentItem { title: string; subtitle: string; group?: string; img: string | null; notes?: string[]; sections: SpecSection[] }
export type EquipmentKind = 'uniforms' | 'vehicles' | 'weapons';

export const EQUIPMENT_LABEL: Record<EquipmentKind, string> = { uniforms: 'Uniforms', vehicles: 'Vehicles', weapons: 'Weapons & gear' };
export const EQUIPMENT_NOTE: Record<EquipmentKind, string> = {
  uniforms: 'Required clothing and optional accessories are listed separately. Accessories visible in photos do not change the written requirements.',
  vehicles: 'Use the authorized rank range shown. Confirm any unlisted option with your supervisor.',
  weapons: 'Use the written configuration. Photos are visual references and may show different tints or optional equipment.',
};

const SAHP_MEDIA = 'https://sahp-command-portal.breat-ease.chatgpt.site';

type Raw = { title?: string; name?: string; ranks?: string; item?: string; category?: string; group?: string; img: string | null; notes?: string[]; sections: SpecSection[] };
const norm = (base: string, list: Raw[], sub: (r: Raw) => string, group?: (r: Raw) => string | undefined): EquipmentItem[] =>
  list.map((r) => ({
    title: r.title ?? r.name ?? '', subtitle: sub(r), group: group?.(r), notes: r.notes,
    img: r.img ? (r.img.startsWith('http') ? r.img : base + r.img) : null, sections: r.sections,
  }));

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export const EQUIPMENT: Record<string, Partial<Record<EquipmentKind, EquipmentItem[]>>> = {
  // From the BCSO on-duty and formal uniform structure threads in the LE Discord.
  bcso: {
    uniforms: norm('', bcsoUniforms as Raw[], (r) => r.ranks ?? '', (r) => r.group),
  },
  sahp: {
    uniforms: norm(SAHP_MEDIA, sahpUniforms as Raw[], (r) => r.ranks ?? ''),
    vehicles: norm(SAHP_MEDIA, sahpVehicles as Raw[], (r) => r.ranks ?? '', (r) => r.group && titleCase(r.group)),
    weapons: norm(SAHP_MEDIA, sahpWeapons as Raw[], (r) => `In-game: ${r.item}`, (r) => r.category),
  },
};

export const equipmentKinds = (dept: string) =>
  (Object.keys(EQUIPMENT_LABEL) as EquipmentKind[]).filter((k) => EQUIPMENT[dept]?.[k]?.length);
