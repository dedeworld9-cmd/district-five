// Pure-logic checks. Run with: npm run test:unit (Node 22.18+, no extra dependencies).
import test from 'node:test';
import assert from 'node:assert/strict';
import { atLeast, canGrantRank, tierRank } from '../lib/tiers.ts';
import { RANK_ROLES, rankFromRoles } from '../lib/discord.ts';
import { friendly } from '../lib/errors.ts';

test('tier ordering', () => {
  assert.equal(tierRank(null), 0);
  assert.ok(atLeast('high_command', 'supervisor'));
  assert.ok(!atLeast('patrol', 'supervisor'));
  assert.ok(atLeast('department_head', 'department_head'));
});

test('rankFromRoles picks the highest rank role and ignores group roles', () => {
  const id = (rank) => RANK_ROLES.find(([, r]) => r === rank)[0];
  assert.equal(rankFromRoles([]), null);
  assert.equal(rankFromRoles(['1563976995698901003']), null); // Field Staff group role
  assert.equal(rankFromRoles([id('Deputy First Class')]), 'Deputy First Class');
  assert.equal(rankFromRoles([id('Sergeant'), id('Master Deputy'), '1563753564067602526']), 'Sergeant');
  assert.equal(rankFromRoles([id('Sheriff'), id('Major')]), 'Sheriff');
});

test('every ranked Discord role maps to a distinct rank', () => {
  assert.equal(new Set(RANK_ROLES.map(([i]) => i)).size, 12);
  assert.equal(new Set(RANK_ROLES.map(([, r]) => r)).size, 12);
});

const rank = (tier, sort_order) => ({ tier, sort_order });
const hcsoHead = (rankSort) => ({ unrestricted: false, dept: 'hcso', tier: 'department_head', rankSort });

test('canGrantRank: admins and division command are unrestricted', () => {
  assert.ok(canGrantRank({ unrestricted: true, dept: 'hcso', tier: null, rankSort: null }, rank('department_head', 120)));
});

test('canGrantRank: HCSO Office of the Sheriff grants only strictly below their own rank', () => {
  assert.ok(canGrantRank(hcsoHead(120), rank('department_head', 110))); // Sheriff -> Undersheriff
  assert.ok(!canGrantRank(hcsoHead(120), rank('department_head', 120))); // no second Sheriff
  assert.ok(!canGrantRank(hcsoHead(110), rank('department_head', 120))); // Undersheriff -> Sheriff
  assert.ok(!canGrantRank(hcsoHead(null), rank('patrol', 30))); // no rank on file, no grant
});

test('canGrantRank: other departments keep the same-tier rule', () => {
  const bcso = { unrestricted: false, dept: 'bcso', tier: 'department_head', rankSort: 120 };
  assert.ok(canGrantRank(bcso, rank('high_command', 80)));
  assert.ok(!canGrantRank(bcso, rank('department_head', 110)));
  const captain = { unrestricted: false, dept: 'hcso', tier: 'high_command', rankSort: 80 };
  assert.ok(canGrantRank(captain, rank('supervisor', 70)));
  assert.ok(!canGrantRank(captain, rank('high_command', 90)));
});

test('friendly(): member-safe messages, no raw database text', () => {
  assert.equal(friendly({ code: 'D5403', message: 'High command authority is required.' }), 'High command authority is required.');
  assert.match(friendly({ code: '42501', message: 'rls' }), /permission/);
  assert.match(friendly({ code: '23514', message: 'new row violates check constraint "x"' }), /too long/);
  assert.doesNotMatch(friendly({ code: 'XX000', message: 'secret internal detail' }), /secret/);
});
