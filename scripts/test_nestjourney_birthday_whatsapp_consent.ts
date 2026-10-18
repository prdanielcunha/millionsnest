import assert from 'node:assert/strict'
import {mayEnableBirthdayGreeting} from '../src/server/services/NestJourneyBirthdayWhatsAppConsentService.js'
const person={organizationId:'org_example',congregationId:'industrial',consent:true,phone:'5543987654321'}
const birthday={organizationId:'org_example',congregationId:'industrial',month:8,day:11}
assert.equal(mayEnableBirthdayGreeting(person,birthday,'org_example'),true)
assert.equal(mayEnableBirthdayGreeting({...person,consent:false},birthday,'org_example'),false)
assert.equal(mayEnableBirthdayGreeting({...person,phone:''},birthday,'org_example'),false)
assert.equal(mayEnableBirthdayGreeting({...person,deletedAt:Date.now()},birthday,'org_example'),false)
assert.equal(mayEnableBirthdayGreeting({...person,congregationId:'other'},birthday,'org_example'),false)
assert.equal(mayEnableBirthdayGreeting(person,{...birthday,organizationId:'other'},'org_example'),false)
assert.equal(mayEnableBirthdayGreeting(person,{},'org_example'),false)
console.log('NESTJOURNEY_BIRTHDAY_WHATSAPP_CONSENT_GUARD_OK')
