import admin from 'firebase-admin';
import { runNestJourneyDueRecovery } from './services/NestJourneyDueOutbox.js';
try {
  const result=await runNestJourneyDueRecovery({
    enabled:process.env.NESTJOURNEY_CONNECT_FOLLOWUP_EVENTS_ENABLED==='true',
    signingSecret:process.env.NESTJOURNEY_CONNECT_SOURCE_EVENT_SECRET,
    operatorTargetsJson:process.env.NESTJOURNEY_CONNECT_OPERATOR_TARGETS_JSON,
    db:()=>{
      if (!admin.apps.length) admin.initializeApp({projectId:process.env.FIREBASE_PROJECT_ID});
      return admin.firestore();
    },
  });
  console.info(JSON.stringify({event:'connect_source_recovery',source:'nestjourney',...result}));
  if(result.failures)process.exitCode=1;
} catch {
  console.error('JOURNEY_RECOVERY_CONFIGURATION_OR_RUNTIME_FAILED');process.exitCode=1;
}
