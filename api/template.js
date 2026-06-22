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

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id || !/^\d+$/.test(id)) {
    return jsonResp({ error: "Invalid asset ID." }, 400);
  }

  try {
    // Step 1: get asset details to find the texture asset ID
    const infoRes = await fetch(
      `https://economy.roblox.com/v2/assets/${id}/details`,
      { headers: HEADERS }
    );

    if (!infoRes.ok) {
      return jsonResp({ error: "Could not find that asset on Roblox." }, 502);
    }

    const info = await infoRes.json();
    // AssetTypeId 11 = Shirt, 12 = Pants
    if (info.AssetTypeId !== 11 && info.AssetTypeId !== 12) {
      return jsonResp({ error: "Not a classic shirt or pants item." }, 400);
    }

    // Step 2: get the asset XML to find the texture ID
    const xmlRes = await fetch(
      `https://assetdelivery.roblox.com/v1/asset/?id=${id}`,
      { headers: HEADERS }
    );

    if (!xmlRes.ok) {
      return jsonResp({ error: "Could not load asset data." }, 502);
    }

    const xml = await xmlRes.text();

    // Extract texture asset ID from XML
    let textureId = null;
    const urlMatch = xml.match(/<url>[^<]*[?&]id=(\d+)[^<]*<\/url>/i);
    if (urlMatch) textureId = urlMatch[1];
    if (!textureId) {
      const rbxMatch = xml.match(/rbxassetid:\/\/(\d+)/i);
      if (rbxMatch) textureId = rbxMatch[1];
    }

    if (!textureId) {
      return jsonResp({ error: "Could not find texture for this item." }, 404);
    }

    // Step 3: fetch the actual PNG via assetdelivery
    const imgRes = await fetch(
      `https://assetdelivery.roblox.com/v1/asset/?id=${textureId}`,
      { headers: HEADERS }
    );

    if (!imgRes.ok) {
      return jsonResp({ error: "Could not download template image." }, 502);
    }

    const contentType = imgRes.headers.get("content-type") || "image/png";
    if (contentType.startsWith("image/")) {
      const buffer = await imgRes.arrayBuffer();
      return imgResp(buffer, contentType);
    }

    // If we got another redirect/XML, one more hop
    const xml2 = await imgRes.text();
    const urlMatch2 = xml2.match(/<url>[^<]*[?&]id=(\d+)[^<]*<\/url>/i) || xml2.match(/rbxassetid:\/\/(\d+)/i);
    if (!urlMatch2) return jsonResp({ error: "Template not found." }, 404);

    const finalRes = await fetch(
      `https://assetdelivery.roblox.com/v1/asset/?id=${urlMatch2[1]}`,
      { headers: HEADERS }
    );
    if (!finalRes.ok) return jsonResp({ error: "Could not fetch final image." }, 502);
    const buffer = await finalRes.arrayBuffer();
    return imgResp(buffer, finalRes.headers.get("content-type") || "image/png");

  } catch (err) {
    return jsonResp({ error: "Server error: " + err.message }, 500);
  }
}
