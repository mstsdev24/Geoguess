const fetch = require('node-fetch'); 

exports.handler = async (event, context) => {
  try {
    if (!event.body) {
      throw new Error("No body found");
    }
    const { lat, lng, lang } = JSON.parse(event.body);

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const VUE_APP_API_KEY = process.env.VUE_APP_API_KEY;

    // 1. Gea a picture from Google Street View
    const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=640x480&location=${lat},${lng}&key=${VUE_APP_API_KEY}`;
    const imageResponse = await fetch(streetViewUrl);
    
    if (!imageResponse.ok) {
        throw new Error(`Street View API error: ${imageResponse.statusText}`);
    }

    const buffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(buffer).toString('base64');

    // 2. Call Gemini API
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    const body = {
      contents: [{
        parts: [
          { 
            text: `
          Estimate the latitude and longitude of this Google Street View image.

          Return ONLY a valid JSON object:
          { "latitude": number, "longitude": number, "reason": string }

          Do not include markdown or extra text.
          The "reason" must be written in language code "${lang}".
          `
          },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image
            }
          }
        ]
      }],
      generationConfig: {
        responseMimeType: "application/json"
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

    // 3. Parse the response 
    let aiText = data.candidates[0].content.parts[0].text;
    
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
