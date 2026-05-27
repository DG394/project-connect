import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { url } = await request.json();

    if (!url || url.trim().length < 4) {
      return NextResponse.json({ error: "Please provide a company URL." }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "API key not configured. Go to Vercel > Settings > Environment Variables and add ANTHROPIC_API_KEY." }, { status: 500 });
    }

    // Extract domain for logo
    let domain = url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
          },
        ],
        messages: [
          {
            role: "user",
            content: `Research this company and return structured data. The company URL is: ${url}

Search the web for information about this company. Return ONLY valid JSON with no markdown backticks or preamble. Use this exact structure:

{
  "name": "",
  "headquarters": "",
  "industry": "",
  "website": "${url}",
  "description": "",
  "revenue": "",
  "employees": "",
  "ownership_type": "",
  "pe_investor": "",
  "pe_investor_status": "",
  "logo_url": "https://logo.clearbit.com/${domain}"
}

For ownership_type use one of: PE-Backed, Public, Private, Family Owned, VC-Backed, Nonprofit.
For pe_investor_status use one of: Current, Former, N/A.
For description, write 2-3 sentences about what the company does, its market position, and scale.
Leave fields empty if information cannot be found. Do not guess.`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = errData?.error?.message || `API returned status ${res.status}`;
      return NextResponse.json({ error: msg }, { status: res.status });
    }

    const data = await res.json();

    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 400 });
    }

    const textBlocks = data.content?.filter((b) => b.type === "text") || [];
    const text = textBlocks.map((b) => b.text).join("") || "{}";

    const cleaned = text.replace(/```json|```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Could not parse company data from AI response." }, { status: 400 });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ parsed });
  } catch (err) {
    console.error("Company enrich error:", err);
    return NextResponse.json({ error: err.message || "Unknown error occurred." }, { status: 500 });
  }
}
