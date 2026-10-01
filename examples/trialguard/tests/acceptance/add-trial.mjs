// Acceptance check A1: written before any code exists.
const {addTrial} = await import(new URL('../../src/trials.mjs', import.meta.url).href);
let list = [];
list = addTrial(list, {name: 'Netflix', endsOn: '2099-12-20'});
list = addTrial(list, {name: 'Spotify', endsOn: '2099-11-02'});
console.log(`sorted: ${list.map(item => item.name).join(', ')}`);
