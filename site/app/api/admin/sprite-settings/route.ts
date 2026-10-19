import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { HD_SPRITES_KEY, getHdSpritesEnabled, setServerConfig } from "@/lib/server-config";
import { spriteSettingsFormSchema } from "@/lib/validations/admin/sprite-settings";
import { withAudit } from "@/lib/api-audit-wrapper";

export const GET = withAudit(async function GET() {
  const { response } = await requireAdminSession();
  if (response) return response;

  return NextResponse.json({ hdSprites: await getHdSpritesEnabled() });
});

export const PATCH = withAudit(async function PATCH(request: Request) {
  const { session, response } = await requireAdminSession();
  if (response) return response;

  const body = await request.json();
  const parsed = spriteSettingsFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
  }

  await setServerConfig(HD_SPRITES_KEY, parsed.data.hdSprites ? "1" : "0");

  await logAudit({
    accountId: Number(session.user.id),
    action: "update",
    entity: "sprite_settings",
    metadata: parsed.data,
  });

  return NextResponse.json(parsed.data);
});
