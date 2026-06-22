export const config = { runtime: "edge" };

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
};

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}

function imgResp(buffer, contentType) {
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

async function fetchUrl(url) {
  const res = await fetch(url, { headers: HEADERS, redirect: "follow" });
  return res;
}

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id || !/^\d+$/.test(id)) {
    return jsonResp({ error: "Invalid asset ID." }, 400);
  }

  try {
    // Fetch the asset XML directly
    const assetRes = await fetchUrl(`https://assetdelivery.roblox.com/v1/asset/?id=${id}`);

    if (!assetRes.ok) {
      return jsonResp({ error: `Roblox returned ${assetRes.status} for asset ${id}` }, 502);
    }

    const contentType = assetRes.headers.get("content-type") || "";

    // Already an image
    if (contentType.startsWith("image/")) {
      return imgResp(await assetRes.arrayBuffer(), contentType);
    }

    // Parse XML for texture ID
    const xml = await assetRes.text();

    let textureId = null;
    const patterns = [
      /<url>[^<]*[?&]id=(\d+)[^<]*<\/url>/i,
      /rbxassetid:\/\/(\d+)/i,
      /https?:\/\/www\.roblox\.com\/asset\/\?id=(\d+)/i,
    ];
    for (const pattern of patterns) {
      const m = xml.match(pattern);
      if (m) { textureId = m[1]; break; }
    }

    if (!textureId) {
      return jsonResp({ error: "Not a classic clothing item (no texture found).", xml: xml.slice(0, 300) }, 404);
    }

    // Fetch the texture image
    const imgRes = await fetchUrl(`https://assetdelivery.roblox.com/v1/asset/?id=${textureId}`);

    if (!imgRes.ok) {
      return jsonResp({ error: `Roblox returned ${imgRes.status} for texture ${textureId}` }, 502);
    }

    const imgContentType = imgRes.headers.get("content-type") || "image/png";

    if (imgContentType.startsWith("image/")) {
      return imgResp(await imgRes.arrayBuffer(), imgContentType);
    }

    // One more hop if needed
    const xml2 = await imgRes.text();
    let textureId2 = null;
    for (const pattern of patterns) {
      const m = xml2.match(pattern);
      if (m) { textureId2 = m[1]; break; }
    }

    if (!textureId2) {
      return jsonResp({ error: "Could not resolve final texture.", xml: xml2.slice(0, 300) }, 404);
    }

    const finalRes = await fetchUrl(`https://assetdelivery.roblox.com/v1/asset/?id=${textureId2}`);
    if (!finalRes.ok) return jsonResp({ error: `Final texture fetch failed: ${finalRes.status}` }, 502);

    return imgResp(await finalRes.arrayBuffer(), finalRes.headers.get("content-type") || "image/png");

  } catch (err) {
    return jsonResp({ error: "Server error: " + err.message }, 500);
  }
}
