export const config = { runtime: "edge" };

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function jsonErr(msg, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const cdnUrl = searchParams.get("url");

  if (!id || !/^\d+$/.test(id)) return jsonErr("Invalid asset ID.");

  try {
    let imageUrl = cdnUrl;

    // Only hit Roblox if we don't already have the CDN URL
    if (!imageUrl) {
      const thumbRes = await fetch(
        `https://thumbnails.roblox.com/v1/assets?assetIds=${id}&returnPolicy=PlaceHolder&size=420x420&format=Png&isCircular=false`,
        { headers: { "User-Agent": UA } }
      );
      if (!thumbRes.ok) return jsonErr(`Thumbnail API returned ${thumbRes.status}`, 502);
      const thumbData = await thumbRes.json();
      const item = thumbData?.data?.[0];
      if (!item || item.state !== "Completed" || !item.imageUrl) {
        return jsonErr("Thumbnail not available for this item.", 404);
      }
      imageUrl = item.imageUrl;
    }

    // Validate it's actually a Roblox CDN URL before proxying
    if (!/^https:\/\/tr\.rbxcdn\.com\//.test(imageUrl)) {
      return jsonErr("Invalid CDN URL.", 400);
    }

    // Proxy the CDN image back to the browser
    const imgRes = await fetch(imageUrl, { headers: { "User-Agent": UA } });
    if (!imgRes.ok) return jsonErr(`Image fetch failed: ${imgRes.status}`, 502);

    const buffer = await imgRes.arrayBuffer();
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": imgRes.headers.get("content-type") || "image/png",
        "Content-Disposition": `attachment; filename="clothify-${id}.png"`,
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (err) {
    return jsonErr("Server error: " + err.message, 500);
  }
}
