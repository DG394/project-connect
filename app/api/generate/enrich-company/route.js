import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { url } = await request.json();

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
  "logo_url": ""
}

For ownership_type use one of: PE-Backed, Public, Private, Family Owned, VC-Backed, Nonprofit.
For pe_investor_status use one of: Current, Former, N/A.
For logo_url, try to find the company's logo URL (often at /logo.png or from clearbit: https://logo.clearbit.com/{domain}).
For description, write 2-3 sentences about what the company does, its market position, and scale.
Leave fields empty if information cannot be found. Do not guess.`,
          },
        ],
      }),
    });

    const data = await res.json();

    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 400 });
    }

    // Extract text from response (may have tool use blocks mixed in)
    const textBlocks = data.content?.filter((b) => b.type === "text") || [];
    const text = textBlocks.map((b) => b.text).join("") || "{}";

    const cleaned = text.replace(/```json|```/g, "").trim();
    
    // Find the JSON object in the response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Could not parse company data" }, { status: 400 });
    }
    
    const parsed = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ parsed });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
