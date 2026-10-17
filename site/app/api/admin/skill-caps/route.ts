import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import {
  DEFAULT_SKILL_CAP,
  SKILL_CAP_CRITICAL_KEY,
  SKILL_CAP_DODGE_KEY,
  getServerConfig,
  setServerConfig,
} from "@/lib/server-config";
import { skillCapsFormSchema } from "@/lib/validations/admin/skill-caps";
import { withAudit } from "@/lib/api-audit-wrapper";

export const GET = withAudit(async function GET() {
  const { response } = await requireAdminSession();
  if (response) return response;

  const [dodgeCap, criticalCap] = await Promise.all([
    getServerConfig(SKILL_CAP_DODGE_KEY, DEFAULT_SKILL_CAP),
    getServerConfig(SKILL_CAP_CRITICAL_KEY, DEFAULT_SKILL_CAP),
  ]);

  return NextResponse.json({ dodgeCap: Number(dodgeCap), criticalCap: Number(criticalCap) });
});

export const PATCH = withAudit(async function PATCH(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const body = await request.json();
  const parsed = skillCapsFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  await Promise.all([
    setServerConfig(SKILL_CAP_DODGE_KEY, String(parsed.data.dodgeCap)),
    setServerConfig(SKILL_CAP_CRITICAL_KEY, String(parsed.data.criticalCap)),
  ]);

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "skill_caps",
    metadata: parsed.data,
  });

  return NextResponse.json(parsed.data);
});
