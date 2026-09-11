import { CountryCode, Products } from "plaid";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPlaidApi } from "@/lib/plaidClient";
import { formatPlaidError } from "@/lib/plaidError";

const OPTIONAL_PRODUCT_MAP: Record<string, Products> = {
  liabilities: Products.Liabilities,
  investments: Products.Investments,
  recurring: Products.RecurringTransactions,
  income: Products.Income,
  identity: Products.Identity,
  statements: Products.Statements,
};

/** Extra products requested at Link time — e.g. PLAID_OPTIONAL_PRODUCTS=liabilities,investments */
function optionalProducts(): Products[] {
  const raw = process.env.PLAID_OPTIONAL_PRODUCTS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => OPTIONAL_PRODUCT_MAP[s.trim().toLowerCase()])
    .filter((p): p is Products => Boolean(p));
}

export async function POST() {
  const session = await getSession();
  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const client = getPlaidApi();
  if (!client) {
    return NextResponse.json(
      {
        error:
          "Plaid is not configured. Set PLAID_CLIENT_ID, PLAID_SECRET, and PLAID_ENV (sandbox|development|production).",
      },
      { status: 503 },
    );
  }
  try {
    const redirectUri = process.env.PLAID_REDIRECT_URI?.trim();
    const webhookUrl = process.env.PLAID_WEBHOOK_URL?.trim();
    const optional = optionalProducts();
    const request: Parameters<typeof client.linkTokenCreate>[0] = {
      user: { client_user_id: session.user.userId },
      client_name: "Household Budget",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
      transactions: { days_requested: 730 },
    };
    if (optional.length > 0) {
      request.optional_products = optional;
    }
    if (webhookUrl) {
      request.webhook = webhookUrl;
    }
    if (redirectUri) {
      request.redirect_uri = redirectUri;
    }
    const { data } = await client.linkTokenCreate(request);
    return NextResponse.json({ link_token: data.link_token });
  } catch (e) {
    const msg = formatPlaidError(e, "link token create");
    console.error("[plaid] create_link_token failed:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
