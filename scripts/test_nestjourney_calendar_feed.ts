import assert from 'node:assert/strict'
import {dateForYear,renderBirthdaySubscription} from '../src/server/services/NestJourneyBirthdayCalendarFeedService.js'
const feb28=dateForYear(2,29,2027)
assert.equal(feb28.toISOString().slice(0,10),'2027-02-28')
assert.equal(dateForYear(2,29,2028).toISOString().slice(0,10),'2028-02-29')
assert.throws(()=>dateForYear(2,30,2028))
assert.throws(()=>dateForYear(13,1,2028))
const ics=renderBirthdaySubscription([
  {id:'sample-a',name:'Pessoa Exemplo',month:2,day:29},
  {id:'sample-b',name:'Maria;Silva',month:10,day:19},
  {id:'bad',name:'<image>',month:14,day:99}
],new Date('2026-10-18T12:00:00Z'))
assert(ics.startsWith('BEGIN:VCALENDAR\r\n'))
assert(ics.includes('SUMMARY:Aniversário de Pessoa Exemplo'))
assert(ics.includes('SUMMARY:Aniversário de Maria\\;Silva'))
assert(ics.includes('RRULE:FREQ=YEARLY'))
assert(ics.includes('DTSTART;VALUE=DATE:20270228'))
assert(!ics.includes('month=14'))
assert(!ics.includes('tel:'))
assert(!ics.includes('5543999999999'))
assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,41)
console.log('NESTJOURNEY_CALENDAR_SUBSCRIPTION_FORMAT_OK')
