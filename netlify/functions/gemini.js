// netlify/functions/gemini.js
export default async (request) => {
  try {
    // ① フロントから座標（lat, lng）を受け取る
    const { lat, lng } = await request.json();

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

    // ② Google Street View Static API から画像を取得
    const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=640x480&location=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;
    const imageResponse = await fetch(streetViewUrl);
    const buffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(buffer).toString('base64');

    // ③ Gemini API 呼び出し (inlineDataを使用)
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const body = {
      contents: [{
        parts: [
          { text: "Estimate the latitude and longitude of this Google Street View image. Return JSON only: {\"latitude\": number, \"longitude\": number, \"reason\": string}" },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image
            }
          }
        ]
      }]
    };

    const geminiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await geminiResponse.json();

    // Geminiの回答テキスト（JSON文字列）を解析して返す
    const aiText = data.candidates[0].content.parts[0].text;
    const aiResult = JSON.parse(aiText.replace(/```json|```/g, "")); // 余計な装飾を除去

    return new Response(JSON.stringify(aiResult), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
