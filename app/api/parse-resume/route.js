import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const resumeText = body.resumeText;

    if (!resumeText || resumeText.trim().length < 20) {
      return NextResponse.json({ error: "Please provide resume text (at least 20 characters)." }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "API key not configured. Go to Vercel > Settings > Environment Variables and add ANTHROPIC_API_KEY." }, { status: 500 });
    }

    var promptText = "Parse this resume and extract structured data. Return ONLY valid JSON with no markdown backticks or preamble. Use this exact structure:\n\n";
    promptText += '{"full_name":"","current_title":"","current_company":"","email":"","phone":"","location":"","linkedin_url":"","education":"","certifications":"","pe_exposure":"","headline":"","summary":"","work_history":[{"company_name":"","title":"","start_year":"","end_year":"","notes":""}]}\n\n';
    promptText += "For pe_exposure, look for any mention of private equity firms, PE-backed companies, or PE experience. List firm names separated by commas. If none found, leave empty.\n\n";
    promptText += "For headline, create a brief one-line professional summary (e.g., PE-backed healthcare CFO with M&A and multi-site operations experience).\n\n";
    promptText += "For summary, write 2-3 sentences capturing the candidates career trajectory and key strengths.\n\n";
    promptText += "For education, combine all degrees into one string (e.g., MBA, Wharton; BS Finance, Penn State).\n\n";
    promptText += "For certifications, combine all (e.g., CPA, CFA).\n\n";
    promptText += "Resume text:\n" + resumeText;

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
      return NextResponse.json({ error: "Could not parse resume data from AI response." }, { status: 400 });
    }

    var parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ parsed: parsed });
  } catch (err) {
    console.error("Resume parse error:", err);
    return NextResponse.json({ error: err.message || "Unknown error occurred." }, { status: 500 });
  }
}
