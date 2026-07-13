import re

with open('firestore.rules', 'r', encoding='utf-8') as f:
    content = f.read()

# Update members create rule
content = content.replace(
    "allow create: if isAuthenticated() && (\n          uid == request.auth.uid || isOrgAdmin(orgId) || isSystemAdmin()\n        );",
    "allow create: if isAuthenticated() && (isOrgAdmin(orgId) || isSystemAdmin());"
)
content = content.replace(
    "allow create: if isAuthenticated() && (\n          uid == request.auth.uid || isOrgAdmin(orgId) || isSystemAdmin()\n        )",
    "allow create: if isAuthenticated() && (isOrgAdmin(orgId) || isSystemAdmin())"
)

# Update organization_members create rule
content = re.sub(
    r"match /organization_members/\{memberId\} \{[\s\S]*?allow create: if isAuthenticated\(\) && \([\s\S]*?\);",
    r"match /organization_members/{memberId} {\n      allow read, list: if isAuthenticated() && (memberId.matches('^' + request.auth.uid + '_.*') || isSystemAdmin());\n      allow create: if isAuthenticated() && isSystemAdmin();",
    content
)

with open('firestore.rules', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
