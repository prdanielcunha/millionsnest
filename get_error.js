const fs = require('fs');
let code = fs.readFileSync('src/server/services/ConnectSessionContextService.ts', 'utf8');
code = code.replace("deps.logger.error('ConnectSessionContext failed'", "console.error('SERVER ERROR', err); deps.logger.error('ConnectSessionContext failed'");
fs.writeFileSync('src/server/services/ConnectSessionContextService.ts', code);
