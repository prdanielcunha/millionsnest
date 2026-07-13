import re

with open('src/pages/Join.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# remove handleRequestAccess
content = re.sub(r"  const handleRequestAccess = async \(\) => \{[\s\S]*?  \};", "", content)

# remove states
content = content.replace("'requesting_access' | 'access_requested'", "")
content = re.sub(r"        \{status === 'requesting_access' && \([\s\S]*?        \)\}\n", "", content)
content = re.sub(r"        \{status === 'access_requested' && \([\s\S]*?        \)\}\n", "", content)

with open('src/pages/Join.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
