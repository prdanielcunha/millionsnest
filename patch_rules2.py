import re

with open('firestore.rules', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = r"allow create: if isAuthenticated\(\) && \(\n\s*request.resource.data.get\('uid', ''\) == request.auth.uid \|\| \n\s*request.resource.data.get\('user_id', ''\) == request.auth.uid \|\| \n\s*id.split\('_'\)\[0\] == request.auth.uid \|\| \n\s*isOrgAdmin\(id.split\('_'\)\[1\]\) \|\|\n\s*isSystemAdmin\(\)\n\s*\);"

replacement = "allow create: if isAuthenticated() && (isOrgAdmin(id.split('_')[1]) || isSystemAdmin());"

content = re.sub(pattern, replacement, content)

with open('firestore.rules', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
