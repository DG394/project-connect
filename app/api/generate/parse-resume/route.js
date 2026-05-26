import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { resumeText } = await request.json();

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
        messages: [
          {
            role: "user",
            content: `Parse this resume and extract structured data. Return ONLY valid JSON with no markdown backticks or preamble. Use this exact structure:

{
  "full_name": "",
  "current_title": "",
  "current_company": "",
  "email": "",
  "phone": "",
  "location": "",
  "linkedin_url": "",
  "education": "",
  "certifications": "",
  "pe_exposure": "",
  "headline": "",
  "summary": "",
  "work_history": [
    {
      "company_name": "",
      "title": "",
      "start_year": "",
      "end_year": "",
      "notes": ""
    }
  ]
}

For pe_exposure, look for any mention of private equity firms, PE-backed companies, or PE experience. List firm names separated by commas. If none found, leave empty.

For headline, create a brief one-line professional summary (e.g., "PE-backed healthcare CFO with M&A and multi-site operations experience").

For summary, write 2-3 sentences capturing the candidate's career trajectory and key strengths.

For education, combine all degrees into one string (e.g., "MBA, Wharton; BS Finance, Penn State").

For certifications, combine all (e.g., "CPA, CFA").

Resume text:
${resumeText}`,
          },
        ],
      }),
    });

    const data = await res.json();

    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 400 });
    }

    const text =
      data.content
        ?.filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("") || "{}";

    // Clean and parse JSON
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json({ parsed });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
