import test from "node:test";
import assert from "node:assert/strict";
import { resolveWorkspace } from "../../src/lib/workspace";

test("signed out: no workspace", () => {
  assert.deepEqual(resolveWorkspace({}), { personId: null, workspaceId: null, isTeam: false, isAdmin: false });
  assert.equal(resolveWorkspace({ userId: null, orgId: "org_1" }).workspaceId, null, "an organization without a person is never a workspace");
});

test("no active team: the person's own workspace, and they manage it", () => {
  assert.deepEqual(resolveWorkspace({ userId: "user_a" }), { personId: "user_a", workspaceId: "user_a", isTeam: false, isAdmin: true });
  assert.equal(resolveWorkspace({ userId: "user_a", orgId: null, orgRole: "org:admin" }).workspaceId, "user_a");
});

test("active team: the team's workspace, shared by every member; only admins manage billing", () => {
  const admin = resolveWorkspace({ userId: "user_a", orgId: "org_1", orgRole: "org:admin" });
  const member = resolveWorkspace({ userId: "user_b", orgId: "org_1", orgRole: "org:member" });
  assert.equal(admin.workspaceId, "org_1");
  assert.equal(member.workspaceId, "org_1");
  assert.equal(admin.workspaceId, member.workspaceId, "two members see the same workspace");
  assert.deepEqual([admin.isTeam, admin.isAdmin], [true, true]);
  assert.deepEqual([member.isTeam, member.isAdmin], [true, false]);
  assert.equal(member.personId, "user_b", "the person stays known for personal limits and personal data");
  assert.equal(resolveWorkspace({ userId: "user_c", orgId: "org_1" }).isAdmin, false, "no role means no admin rights");
});
