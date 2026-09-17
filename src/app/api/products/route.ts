import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { listPublishedProducts } from "@/server/services/product.service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") ?? undefined;
    const featured = searchParams.get("featured") === "true";

    const products = await listPublishedProducts({ categorySlug: category, featuredOnly: featured });
    return NextResponse.json({ products });
  } catch (err) {
    return apiError(err);
  }
}
