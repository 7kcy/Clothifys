export const config = { runtime: "edge" };

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "*/*",
};

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id || !/^\d+$/.test(id)) {
    return jsonResp({ error: "Invalid asset ID." }, 400);
  }

  try {
    // Use the catalog asset thumbnail API — publicly accessible from any IP
    const thumbRes = await fetch(
      `https://thumbnails.roblox.com/v1/assets?assetIds=${id}&returnPolicy=PlaceHolder&size=420x420&format=Png&isCircular=false`,
      { headers: HEADERS }
    );

    if (!thumbRes.ok) {
      return jsonResp({ error: `Thumbnail API returned ${thumbRes.status}` }, 502);
    }

    const thumbData = await thumbRes.json();
    const thumbItem = thumbData?.data?.[0];

    if (!thumbItem || thumbItem.state !== "Completed" || !thumbItem.imageUrl) {
      return jsonResp({ error: "Thumbnail not available for this item." }, 404);
    }

    // Fetch the actual image from the CDN URL
    const imgRes = await fetch(thumbItem.imageUrl, { headers: HEADERS });

    if (!imgRes.ok) {
      return jsonResp({ error: `Image fetch failed: ${imgRes.status}` }, 502);
    }

    const buffer = await imgRes.arrayBuffer();
    const contentType = imgRes.headers.get("content-type") || "image/png";

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*"
      }
    });

  } catch (err) {
    return jsonResp({ error: "Server error: " + err.message }, 500);
  }
}
