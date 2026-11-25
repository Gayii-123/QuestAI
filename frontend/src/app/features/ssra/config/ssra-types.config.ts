/**
 * QuestAI — SSRA Operational Domain Types Catalogue
 *
 * 14 active operational SSRA domains.
 * 4 legacy DoNotUse variants are explicitly excluded from new selection.
 */

import { SsraDomainTypeInfo } from '../models/ssra.models';
export type { SsraDomainTypeInfo };

export const SSRA_DOMAIN_TYPES: SsraDomainTypeInfo[] = [
  {
    key: 'civil-callout',
    title: 'Civil Callout',
    department: 'Civil Engineering',
    icon: 'wrench',
    description: 'Emergency and responsive civil engineering callouts, street works, and fast-track repairs.',
    hotWorksTriggerQId: 'cc-q10',
  },
  {
    key: 'civil-planned',
    title: 'Civil Planned',
    department: 'Civil Engineering',
    icon: 'calendar-check',
    description: 'Scheduled civil works, footway reconstruction, paving, and planned kerbing schemes.',
    hotWorksTriggerQId: 'cp-q10',
  },
  {
    key: 'civil-reactive',
    title: 'Civil Reactive',
    department: 'Civil Engineering',
    icon: 'activity',
    description: 'Day-to-day reactive civil repairs, emergency pothole patching, and ironwork stabilization.',
    hotWorksTriggerQId: 'cr-q09',
  },
  {
    key: 'crossover',
    title: 'Crossover',
    department: 'Highways & Infrastructure',
    icon: 'layers',
    description: 'Domestic and commercial vehicular crossing installations and kerb lowering works.',
    hotWorksTriggerQId: 'co-q08',
  },
  {
    key: 'grab-lorry',
    title: 'Grab Lorry / Site Delivery',
    department: 'Logistics & Fleet',
    icon: 'truck',
    description: 'Grab lorry operations, muck away, material delivery, overhead cable proximity, and offloading.',
    hotWorksTriggerQId: 'gl-q07',
  },
  {
    key: 'gully-cleansing',
    title: 'Gully Cleansing',
    department: 'Environmental Services',
    icon: 'droplet',
    description: 'High-pressure water jetting, suction tanker operations, chamber entry safety, and road runoff.',
    hotWorksTriggerQId: 'gc-q08',
  },
  {
    key: 'mechanic-roadside',
    title: 'Mechanic Roadside',
    department: 'Fleet & Workshop',
    icon: 'tool',
    description: 'On-highway breakdown assistance, wheel changes, live-lane breakdown recovery, and roadside triage.',
    hotWorksTriggerQId: 'mr-q08',
  },
  {
    key: 'mechanic-workshop',
    title: 'Mechanic Workshop',
    department: 'Fleet & Workshop',
    icon: 'settings',
    description: 'Depot vehicle servicing, ramp lifting, hydraulic maintenance, hot repairs, and bench testing.',
    hotWorksTriggerQId: 'mw-q06',
  },
  {
    key: 'road-marking',
    title: 'Road Marking',
    department: 'Surfacing & Lining',
    icon: 'edit-3',
    description: 'Thermoplastic line marking, preformed markings, screed box handling, and high-temp boilers.',
    hotWorksTriggerQId: 'rm-q08',
  },
  {
    key: 'road-surfacing',
    title: 'Road Surfacing',
    department: 'Surfacing & Lining',
    icon: 'navigation',
    description: 'Macadam laying, asphalt planing, paver screed operations, deadweight rolling, and hot bitumen.',
    hotWorksTriggerQId: 'rs-q11',
  },
  {
    key: 'street-lighting',
    title: 'Street Lighting',
    department: 'Electrical & Lighting',
    icon: 'zap',
    description: 'Column erection, luminaire replacement, cut-out isolations, MEWP access, and cabling.',
    hotWorksTriggerQId: 'sl-q09',
  },
  {
    key: 'traffic-management',
    title: 'Traffic Management',
    department: 'Traffic Safety',
    icon: 'shield',
    description: 'Lane closures, contraflow installation, temporary signals, stop/go boards, and high-speed taper setup.',
    hotWorksTriggerQId: 'tm-q09',
  },
  {
    key: 'utility-survey',
    title: 'Utility Survey',
    department: 'Technical Services',
    icon: 'search',
    description: 'Electromagnetic location (CAT), ground penetrating radar (GPR), chamber lifting, and trial pitting.',
    hotWorksTriggerQId: 'us-q08',
  },
  {
    key: 'winter-maintenance',
    title: 'Winter Maintenance',
    department: 'Highways & Fleet',
    icon: 'cloud-snow',
    description: 'Pre-salting runs, gritting vehicle operations, snow ploughing, sub-zero conditions, and night shifts.',
    hotWorksTriggerQId: 'wm-q07',
  },

  // 4 Legacy variants (DoNotUse)
  {
    key: 'legacy-general',
    title: 'Legacy General SSRA (DoNotUse)',
    department: 'Legacy Archives',
    icon: 'archive',
    description: 'Superseded generic risk assessment form. Excluded from active selection.',
    isLegacy: true,
  },
  {
    key: 'legacy-civil',
    title: 'Legacy Civil SSRA (DoNotUse)',
    department: 'Legacy Archives',
    icon: 'archive',
    description: 'Superseded civil risk assessment form. Excluded from active selection.',
    isLegacy: true,
  },
  {
    key: 'legacy-surfacing',
    title: 'Legacy Surfacing SSRA (DoNotUse)',
    department: 'Legacy Archives',
    icon: 'archive',
    description: 'Superseded surfacing risk assessment form. Excluded from active selection.',
    isLegacy: true,
  },
  {
    key: 'legacy-tm',
    title: 'Legacy Traffic Management (DoNotUse)',
    department: 'Legacy Archives',
    icon: 'archive',
    description: 'Superseded traffic management form. Excluded from active selection.',
    isLegacy: true,
  },
];

export const ACTIVE_SSRA_DOMAINS = SSRA_DOMAIN_TYPES.filter((t) => !t.isLegacy);
export const LEGACY_DO_NOT_USE_DOMAINS = SSRA_DOMAIN_TYPES.filter((t) => t.isLegacy);

export function getActiveSsraTypes(): SsraDomainTypeInfo[] {
  return ACTIVE_SSRA_DOMAINS;
}

export function getSsraTypeByKey(key: string): SsraDomainTypeInfo | undefined {
  return SSRA_DOMAIN_TYPES.find((t) => t.key === key);
}

export function isLegacySsraType(key: string): boolean {
  const item = getSsraTypeByKey(key);
  return !!item?.isLegacy;
}
