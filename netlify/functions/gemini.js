export default async (request) => {
  try {
    // ① フロントから送られたデータを読む
    const { imageUrl } = await request.json();

    // ② 環境変数からAPIキー取得（安全）
    const apiKey = process.env.GEMINI_API_KEY;

    // ③ Gemini API エンドポイント
    const endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
      apiKey;

    // ④ Gemini に送る内容
    const body = {
      contents: [
        {
          parts: [
            {
              text: `
This is a Google Street View image.
Estimate the latitude and longitude.
Return JSON only:
{
  "latitude": number,
  "longitude": number,
  "confidence": number,
  "reason": string
}
              `
            },
            {
              fileData: {
                mimeType: "image/jpeg",
                fileUri: imageUrl
              }
            }
          ]
        }
      ]
    };

    // ⑤ Gemini API 呼び出し
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    // ⑥ ブラウザへ返す
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500 }
    );
  }
};
