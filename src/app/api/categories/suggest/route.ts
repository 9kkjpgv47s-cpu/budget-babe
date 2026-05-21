import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getOrCreateMonthlyPeriod } from "@/lib/dashboardData";
import { suggestCategoryForDescription } from "@/lib/merchantRules";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const description = (searchParams.get("q") ?? "").trim();
  const ym = searchParams.get("ym")?.match(/^\d{4}-\d{2}$/)
    ? searchParams.get("ym")!
    : null;
  if (!description || description.length < 3 || !ym) {
    return NextResponse.json({ message: null });
  }
  const period = await getOrCreateMonthlyPeriod(ym);
  const suggestion = await suggestCategoryForDescription(
    description,
    undefined,
    period.id,
  );
  if (!suggestion) {
    return NextResponse.json({ message: null });
  }
  const parts = [
    suggestion.categoryName,
    suggestion.budgetPlanId ? "budget linked" : null,
    suggestion.taxCategory ? "tax default" : null,
  ].filter(Boolean);
  return NextResponse.json({
    message: parts.join(" · "),
    categoryId: suggestion.categoryId,
  });
}
