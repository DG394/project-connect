import { NextResponse } from "next/server";

var SYSTEM_PROMPT = "You are an AI assistant for a retained executive search firm focused on private equity. ";
SYSTEM_PROMPT += "You generate professional search deliverables: scorecards, job descriptions, search strategies, recruiting messages, and target lists. ";
SYSTEM_PROMPT += "Follow these editorial rules strictly:\n";
SYSTEM_PROMPT += "- Use em dashes (not hyphens or en dashes) for parenthetical statements\n";
SYSTEM_PROMPT += "- Never use bullet-point dashes at the start of lines. Use bold headers followed by a colon instead\n";
SYSTEM_PROMPT += "- Write in a confident, authoritative tone appropriate for board-level audiences\n";
SYSTEM_PROMPT += "- Be specific and data-driven where possible\n";
SYSTEM_PROMPT += "- Avoid generic filler language\n";
SYSTEM_PROMPT += "- For recruiting messages: keep them short, authentic, and relationship-oriented\n";
SYSTEM_PROMPT += "- Never fabricate company names, people, or statistics\n";
SYSTEM_PROMPT += "- When generating target lists, organize by category and include rationale";

export async function POST(request) {
  try {
    const body = await request.json();
    var messages = body.messages;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages array is required." }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "API key not configured. Go to Vercel > Settings > Environment Variables and add ANTHROPIC_API_KEY." }, { status: 500 });
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: messages,
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

    return NextResponse.json({ text: text || "" });
  } catch (err) {
    console.error("Generate error:", err);
    return NextResponse.json({ error: err.message || "Unknown error occurred." }, { status: 500 });
  }
}
