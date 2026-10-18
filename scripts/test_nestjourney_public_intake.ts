import assert from 'node:assert/strict'
import {validJourneyIntakeContact} from '../src/server/services/NestJourneyPublicIntakeService.js'

assert.equal(validJourneyIntakeContact('Maria Silva','(43) 99999-0000'),true)
assert.equal(validJourneyIntakeContact('A','(43) 99999-0000'),false)
assert.equal(validJourneyIntakeContact('Maria','123'),false)
assert.equal(validJourneyIntakeContact('<script>','(43) 99999-0000'),false)
assert.equal(validJourneyIntakeContact('Maria','5543999990000'),true)
console.log('NESTJOURNEY_PUBLIC_INTAKE_VALIDATION_OK')
