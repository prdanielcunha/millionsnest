import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isGlobalPrivilegedUser } from '../src/lib/permissionService.js';

const app = readFileSync('src/App.tsx','utf8');
const shell = readFileSync('src/components/EcosystemShell.tsx','utf8');
const admin = readFileSync('src/pages/EcosystemAdmin.tsx','utf8');

assert.match(app, /path="\/admin\/ecosystem\/organizations" element=\{<EcosystemAdmin\s*\/>\}/);
assert.match(shell, /isGlobalPrivilegedUser\(profile\) && \(\s*<nav aria-label="Acessos administrativos do ecossistema"/);
assert.match(shell, /<Link to="\/admin\/ecosystem\/organizations"/);
assert.match(shell, /Gerenciar organiza[çc][õo]es/);
assert.match(shell, /md:hidden/);
assert.match(admin, /location\.pathname === '\/admin\/ecosystem\/organizations' \? 'organizations' : 'users'/);
assert.match(admin, /setActiveTab\('organizations'\); navigate\('\/admin\/ecosystem\/organizations'\)/);
assert.match(admin, /overflow-x-auto pb-2 md:col-span-1/);
assert.match(admin, /selectedCleanupIds\.length/);
assert.match(admin, /EXCLUIR_ORGANIZACOES_SELECIONADAS/);

for (const systemRole of ['ceo','founder','global_admin','ecosystem_owner','admin']) {
  assert.equal(isGlobalPrivilegedUser({systemRole}), true, systemRole);
}
for (const systemRole of ['user','ecosystem_support',undefined,'owner']) {
  assert.equal(isGlobalPrivilegedUser({systemRole}), false, String(systemRole));
}
console.log('MILLIONSNEST_MOBILE_ADMIN_NAVIGATION_OK');
