import re

with open("src/components/dashboard/EcosystemWorkspaceHome.tsx", "r") as f:
    content = f.read()

# Add AlertCircle to lucide-react if not present
if "AlertCircle" not in content[:content.find("lucide-react")]:
    content = content.replace("} from 'lucide-react';", ", AlertCircle } from 'lucide-react';")

with open("src/components/dashboard/EcosystemWorkspaceHome.tsx", "w") as f:
    f.write(content)
