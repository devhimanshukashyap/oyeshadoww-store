import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { apiError } from "@/lib/api-error";
import { updateProfileSchema } from "@/lib/validation";
import { updateProfileName } from "@/server/services/account.service";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();

    const ip = getClientIp(req.headers);
    const limit = rateLimit(`account-update:${user.id}:${ip}`, 20, 600);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
    }

    const body = updateProfileSchema.parse(await req.json());
    const result = await updateProfileName(user.id, body.name);

    return NextResponse.json(result);
  } catch (err) {
    return apiError(err);
  }
}
