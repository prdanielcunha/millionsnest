const fs = require('fs');

let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf-8');
const lines = code.split('\n');
let newLines = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Ver Todos ({members.length})')) {
    newLines.push(lines[i]); // Ver Todos button
    newLines.push(lines[i+1]); // </button>
    newLines.push(lines[i+2]); // )}
    newLines.push(lines[i+3]); // </div> (for space-y-3)
    newLines.push(lines[i+4]); // </div> (for Team widget)
    newLines.push("                  </div>");
    newLines.push("                </div>");
    newLines.push("              )}");
    newLines.push("            </motion.section>");
    newLines.push("          )}");
    let j = i + 5;
    while (j < lines.length && !lines[j].includes('activeTab === "organization" && (')) {
      j++;
    }
    i = j - 1;
    continue;
  }
  newLines.push(lines[i]);
}

fs.writeFileSync('src/pages/Dashboard.tsx', newLines.join('\n'));
