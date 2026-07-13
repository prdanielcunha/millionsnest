import re

with open('firestore.rules', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("allow create: if isAuthenticated() && (userId == request.auth.uid || isSystemAdmin() || hasOrgContext(incoming()));", "allow create: if isAuthenticated() && isSystemAdmin();")

with open('firestore.rules', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
