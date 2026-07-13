import re

with open('firestore.rules', 'r', encoding='utf-8') as f:
    content = f.read()

# I will replace the incorrect block starting from the bad allow create
bad_block = """        allow create: if isAuthenticated() && (isOrgAdmin(request.resource.data.get('organizationId', '')) || isSystemAdmin());
      allow update: if isAuthenticated() && ("""

good_block = """        allow create: if isAuthenticated() && (isOrgAdmin(orgId) || isSystemAdmin());
        allow update, delete: if isAuthenticated() && (
          isOrgAdmin(orgId) || isSystemAdmin()
        );
      }

      match /invites/{inviteId} {
        allow read, list: if isAuthenticated() && (
          checkOrgAccess(orgId) || isSystemAdmin()
        );
        allow create, update, delete: if isAuthenticated() && (isOrgAdmin(orgId) || isSystemAdmin());
      }

      match /audit_logs/{document=**} {
        allow read: if isAuthenticated() && checkOrgAccess(orgId);
        allow write: if isAuthenticated() && checkOrgAccess(orgId);
      }
    }

    match /organization_members/{id} {
      allow read: if isAuthenticated() && (
        id.split('_')[0] == request.auth.uid ||
        id.split('_')[1] == request.auth.uid ||
        checkOrgAccess(id.split('_')[1]) ||
        checkOrgAccess(id.split('_')[0])
      );
      allow list: if isAuthenticated();
      allow create: if isAuthenticated() && (isOrgAdmin(request.resource.data.get('organizationId', '')) || isSystemAdmin());
      allow update: if isAuthenticated() && ("""

content = content.replace(bad_block, good_block)

with open('firestore.rules', 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed")
