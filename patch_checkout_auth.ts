import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('server.ts', 'utf8');

const regex = /orgId = orgContext\.primaryOrganizationId \|\| orgContext\.activeOrganizationId \|\| \(userDoc\.exists \? userDoc\.data\(\)\?\.organizationId : null\) \|\| userId;(?![ \S\s]*hasBillingPerm)/;

const replacement = `orgId = orgContext.primaryOrganizationId || orgContext.activeOrganizationId || (userDoc.exists ? userDoc.data()?.organizationId : null) || userId;
         
         const isOwner = orgContext.ownedOrganizations.some((org: any) => org.id === orgId);
         const membership = orgContext.memberships.find((m: any) => m.organizationId === orgId);
         const hasBillingPerm = membership?.permissions?.['organization.billing.manage'] === true || membership?.role === 'owner' || membership?.role === 'admin';
         const systemRole = userDoc.data()?.systemRole;
         const isGlobalAdmin = systemRole === 'ceo' || systemRole === 'admin' || systemRole === 'global_admin';
         
         if (!isOwner && !hasBillingPerm && !isGlobalAdmin) {
           return res.status(403).json({ error: 'Você não tem permissão para gerenciar o faturamento desta organização.' });
         }`;

content = content.replace(regex, replacement);

const regex3 = /if \(eligibility\.decision === 'block_duplicate'\) \{\s*return res\.status\(400\)\.json\(\{[\s\S]*?\}\);\s*\}/m;

const replacement3 = `if (eligibility.decision === 'block_duplicate') {
          return res.status(400).json({ 
            ok: false, 
            code: 'ACTIVE_SUBSCRIPTION_EXISTS', 
            action: 'manage_existing_subscription',
            error: 'Sua assinatura já está ativa. Você pode gerenciá-la na área de assinatura.',
            repairRequired: eligibility.repairRequired,
            managementUrl: eligibility.managementUrl,
            orgId: eligibility.orgId
          });
        }`;
content = content.replace(regex3, replacement3);

writeFileSync('server.ts', content);
