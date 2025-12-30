const fetch = require('node-fetch'); // 安全のため commonjs形式で書く場合

exports.handler = async (event, context) => {
  try {
    // Netlify Functions では event.body にデータが入ります
    if (!event.body) {
      throw new Error("No body found");
    }
    const { lat, lng } = JSON.parse(event.body);

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const VUE_APP_API_KEY = process.env.VUE_APP_API_KEY;

    // 1. Google Street View から画像取得
    const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=640x480&location=${lat},${lng}&key=${VUE_APP_API_KEY}`;
    const imageResponse = await fetch(streetViewUrl);
    
    if (!imageResponse.ok) {
        throw new Error(`Street View API error: ${imageResponse.statusText}`);
    }

    const buffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(buffer).toString('base64');

    // 2. Gemini API 呼び出し
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

    const body = {
      contents: [{
        parts: [
          { text: "Estimate the latitude and longitude of this image. Return ONLY a valid JSON object like this: {\"latitude\": 35.0, \"longitude\": 139.0, \"reason\": \"string\"}. Do not include markdown formatting or any other text." },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image
            }
          }
        ]
      }],
      generationConfig: {
        responseMimeType: "application/json" // JSONモードを明示的に指定（Gemini 1.5以降）
      }
    };

    const geminiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await geminiResponse.json();

    if (!data.candidates || !data.candidates[0]) {
        throw new Error("Gemini API returned no candidates: " + JSON.stringify(data));
    }

    // 3. 回答の抽出とパース
    let aiText = data.candidates[0].content.parts[0].text;
    
    // JSON以外の文字列が含まれている場合の対策
    const jsonMatch = aiText.match(/\{.*\}/s);
    if (jsonMatch) {
        aiText = jsonMatch[0];
    }

    const aiResult = JSON.parse(aiText);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(aiResult)
    };

  } catch (err) {
    console.error("Function Error:", err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
