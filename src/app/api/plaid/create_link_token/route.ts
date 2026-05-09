import { CountryCode, Products } from "plaid";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPlaidApi } from "@/lib/plaidClient";
import { formatPlaidError } from "@/lib/plaidError";

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
    const request: Parameters<typeof client.linkTokenCreate>[0] = {
      user: { client_user_id: session.user.userId },
      client_name: "Household Budget",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    };
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
