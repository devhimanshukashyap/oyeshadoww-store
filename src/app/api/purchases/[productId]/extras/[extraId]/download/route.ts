import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createDownloadUrl } from "@/lib/r2";
import { resolveBundlePlusExtraAccess } from "@/server/services/entitlement.service";

export async function GET(
    _request: Request,
    { params }: { params: { productId: string; extraId: string } }
) {
    const user = await getCurrentUser();

    if (!user) {
        return NextResponse.json(
            { error: "Authentication required" },
            { status: 401 }
        );
    }

    const access = await resolveBundlePlusExtraAccess({
        userId: user.id,
        productId: params.productId,
        extraId: params.extraId,
    });

    if (!access.authorized) {
        const status = access.reason === "NOT_OWNED" ? 403 : 404;

        return NextResponse.json(
            { error: "You do not have access to this file." },
            { status }
        );
    }

    const filename =
        access.extra.fileName?.replace(/[^a-zA-Z0-9._ -]/g, "").trim() ||
        "bundle-plus-extra";

    const url = await createDownloadUrl({
        key: access.storageObject.key,
        filename,
        expiresInSeconds: Number(
            process.env.R2_SIGNED_URL_TTL_SECONDS ?? 300
        ),
    });

    return NextResponse.json({
        url,
        expiresInSeconds: Number(
            process.env.R2_SIGNED_URL_TTL_SECONDS ?? 300
        ),
    });
}