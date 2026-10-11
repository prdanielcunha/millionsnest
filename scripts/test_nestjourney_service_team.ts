import assert from 'node:assert/strict';
import { parseJourneyServiceTeam, journeyResponsibilityForTeam } from '../src/server/services/NestJourneyServiceTeam.js';

const support = parseJourneyServiceTeam({
  primaryArea: 'support', teamRole: 'auxiliary', supportAreas: ['presence', 'table'],
});
assert.ok(support);
assert.equal(support.primaryArea, 'support');
assert.equal(journeyResponsibilityForTeam(support), 'member');
assert.equal(parseJourneyServiceTeam({ primaryArea:'support', teamRole:'leader', supportAreas:[] }), null);
assert.equal(parseJourneyServiceTeam({ primaryArea:'support', teamRole:'auxiliary', supportAreas:['support'] }), null);
assert.equal(parseJourneyServiceTeam({ primaryArea:'support', teamRole:'auxiliary', supportAreas:['presence','presence'] }), null);
assert.equal(parseJourneyServiceTeam({ primaryArea:'table', teamRole:'other', supportAreas:[] }), null);
assert.equal(parseJourneyServiceTeam({ primaryArea:'table', teamRole:'other', otherLabel:'Logística', supportAreas:[] })?.otherLabel,'Logística');
assert.equal(journeyResponsibilityForTeam(parseJourneyServiceTeam({ primaryArea:'table', teamRole:'leader', supportAreas:['house'] })!), 'mesa_team');
assert.equal(journeyResponsibilityForTeam(parseJourneyServiceTeam({ primaryArea:'table', teamRole:'integrant', supportAreas:['house'] })!), 'member');
assert.equal(journeyResponsibilityForTeam(parseJourneyServiceTeam({ primaryArea:'house', teamRole:'trainee', supportAreas:['table'] })!), 'member');
assert.equal(parseJourneyServiceTeam({ primaryArea:'finance', teamRole:'leader', supportAreas:[] }), null);
assert.equal(parseJourneyServiceTeam({ primaryArea:'care', teamRole:'admin', supportAreas:[] }), null);
console.log('SUCCESS: NestJourney team assignments isolate support availability from leadership and app grants.');
