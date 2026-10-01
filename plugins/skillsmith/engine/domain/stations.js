/** The six stations of the production line, in order. */
/** Station ids in pipeline order. */
export const STATION_IDS = [
    'interview',
    'research',
    'hooks',
    'screenplay',
    'arena',
    'ship',
];
/** Every station, in order. */
export const STATIONS = [
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
        crew: '3 rival teams, 1 auditor',
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
export function isStationId(value) {
    return typeof value === 'string' && STATION_IDS.includes(value);
}
/** Looks up a station; the id must be valid. */
export function station(id) {
    const found = STATIONS.find(item => item.id === id);
    if (!found)
        throw new Error(`Unknown station ${id}`);
    return found;
}
