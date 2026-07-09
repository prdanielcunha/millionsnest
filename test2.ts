import fs from 'fs';
const serverCode = fs.readFileSync('server.ts', 'utf8');
const subStatusIndex = serverCode.indexOf("app.get('/api/debug/subscription-status'");
const code = serverCode.substring(subStatusIndex, subStatusIndex + 8000);
console.log("length:", code.length);
console.log("has audit logs:", code.includes("audit_logs"));
console.log("has single quote:", code.includes("audit_logs')"));
console.log("has add:", code.includes(".add"));
console.log("exact:", code.includes("audit_logs').add"));
