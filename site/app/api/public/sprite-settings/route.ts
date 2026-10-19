import { NextResponse } from "next/server";

import { getHdSpritesEnabled } from "@/lib/server-config";

/** Lido por `useHdSprites` pra decidir se as URLs de sprite apontam pra versão HD. */
export async function GET() {
  return NextResponse.json({ hdSprites: await getHdSpritesEnabled() });
}
