import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    var url = body.url;

    if (!url || url.trim().length < 5) {
      return NextResponse.json({ error: "Please provide a company URL." }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "API key not configured. Go to Vercel > Settings > Environment Variables and add ANTHROPIC_API_KEY." }, { status: 500 });
    }

    var promptText = "Based on this company website URL, provide what you know about this company. Return ONLY valid JSON with no markdown backticks or preamble. Use this exact structure:\n\n";
    promptText += '{"name":"","headquarters":"","industry":"","website":"","revenue":"","employees":"","ownership_type":"","pe_investor":"","description":"","logo_url":""}\n\n';
    promptText += "For ownership_type use one of: PE-Backed, Public, Private, Family Owned, VC-Backed, Nonprofit.\n";
    promptText += "Leave fields empty if unknown. Do not guess.\n\n";
    promptText += "Company URL: " + url;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        messages: [{ role: "user", content: promptText }],
      }),
    });

    if (!res.ok) {
      var errData = {};
      try { errData = await res.json(); } catch(e) {}
      var msg = (errData && errData.error && errData.error.message) ? errData.error.message : ("API returned status " + res.status);
      return NextResponse.json({ error: msg }, { status: res.status });
    }

    const data = await res.json();

    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 400 });
    }

    var text = "";
    if (data.content) {
      for (var i = 0; i < data.content.length; i++) {
        if (data.content[i].type === "text") text += data.content[i].text;
      }
    }
    if (!text) text = "{}";

    var bt3 = String.fromCharCode(96,96,96); var cleaned = text.replace(new RegExp(bt3+"json","g"), "").replace(new RegExp(bt3,"g"), "").trim();
    var jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Could not parse company data from AI response." }, { status: 400 });
    }

    var parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ parsed: parsed });
  } catch (err) {
    console.error("Company enrich error:", err);
    return NextResponse.json({ error: err.message || "Unknown error occurred." }, { status: 500 });
  }
}
