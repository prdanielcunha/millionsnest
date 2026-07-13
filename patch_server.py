import re

with open('server.ts', 'r', encoding='utf-8') as f:
    content = f.read()

import_statement = "import { bootstrapUserContext, acceptInvitation, setActiveOrganization } from './src/server/services/TenantContextMutationService.js';\n"
if "TenantContextMutationService" not in content:
    content = content.replace("import express from 'express';", "import express from 'express';\n" + import_statement)

routes = """
  // P0-A Security and Governance Routes
  app.post('/api/v1/onboarding/bootstrap', express.json(), bootstrapUserContext);
  app.post('/api/v1/invitations/accept', express.json(), acceptInvitation);
  app.post('/api/v1/user/active-organization', express.json(), setActiveOrganization);
"""

if "/api/v1/onboarding/bootstrap" not in content:
    # Find a good place to insert. Let's insert before startServer
    insert_pos = content.find("async function startServer()")
    if insert_pos != -1:
        # Find where the routes are added inside startServer
        routes_start = content.find("app.post('/api/internal/repair-subscription'", insert_pos)
        if routes_start != -1:
             content = content[:routes_start] + routes + "\n  " + content[routes_start:]
        else:
             print("Could not find routes start")
    else:
        print("Could not find startServer")

with open('server.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
