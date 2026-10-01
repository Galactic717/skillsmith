/** The six stations of the production line, in order. */

/** Station ids in pipeline order. */
export const STATION_IDS = [
  'interview',
  'research',
  'hooks',
  'screenplay',
  'arena',
  'ship',
] as const;

/** One of STATION_IDS. */
export type StationId = (typeof STATION_IDS)[number];

/** A station on the line. */
export interface Station {
  id: StationId;
  title: string;
  /** Who works at this station, in the founder's words. */
  crew: string;
  /** Files in `.skillsmith/` the station produces; hashed on approval. */
  outputs: readonly string[];
  /** The plugin skill that runs the station. */
  skill: string;
  /** Whether the founder may skip it. The arena needs the brief and screenplay. */
  skippable: boolean;
}

/** Every station, in order. */
export const STATIONS: readonly Station[] = [
  {
    id: 'interview',
    title: 'Interview',
    crew: 'Interviewer',
    outputs: ['01-brief.md'],
    skill: 'skillsmith:interview',
    skippable: false,
  },
  {
    id: 'research',
    title: 'Research',
    crew: 'Researchers',
    outputs: ['02-research.md', '02-sources.json'],
    skill: 'skillsmith:research',
    skippable: true,
  },
  {
    id: 'hooks',
    title: 'Hooks',
    crew: 'Hook writer',
    outputs: ['03-hooks.md'],
    skill: 'skillsmith:hooks',
    skippable: true,
  },
  {
    id: 'screenplay',
    title: 'Screenplay',
    crew: 'Screenwriter',
    outputs: ['04-screenplay.md', '04-acceptance.json', '04-vacuity.json'],
    skill: 'skillsmith:screenplay',
    skippable: false,
  },
  {
    id: 'arena',
    title: 'Arena',
    crew: '3 managers with their developers and designers, the auditor',
    outputs: ['arena.json', 'scoreboard.md', 'graveyard.md'],
    skill: 'skillsmith:arena',
    skippable: false,
  },
  {
    id: 'ship',
    title: 'Ship',
    crew: 'Release crew',
    outputs: ['REPORT.md'],
    skill: 'skillsmith:ship',
    skippable: false,
  },
];

/** Type guard for station ids typed by people and agents. */
export function isStationId(value: unknown): value is StationId {
  return typeof value === 'string' && (STATION_IDS as readonly string[]).includes(value);
}

/** Looks up a station; the id must be valid. */
export function station(id: StationId): Station {
  const found = STATIONS.find(item => item.id === id);
  if (!found) throw new Error(`Unknown station ${id}`);
  return found;
}
