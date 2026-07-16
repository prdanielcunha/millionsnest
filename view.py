import re
with open("src/components/dashboard/MusicScaleGuideCenter.tsx", "r") as f:
    content = f.read()

print("File len:", len(content))

for match in re.finditer(r'renderOverviewHighlights\s*=\s*\(\)\s*=>\s*\{', content):
    start = match.start()
    end = content.find('};', start)
    if end != -1:
        print(content[start:end+2])
