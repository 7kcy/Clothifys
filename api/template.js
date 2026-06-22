const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

export const config = { runtime: "edge" };

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id || !/^\d+$/.test(id)) {
    return new Response(JSON.stringify({ error: "Invalid asset ID." }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  try {
    const deliveryRes = await fetch(
      `https://assetdelivery.roblox.com/v1/assetId/${id}`,
      { headers: HEADERS }
    );

    if (!deliveryRes.ok) {
      return new Response(JSON.stringify({ error: "Could not reach Roblox. Try again shortly." }), {
        status: 502,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    const deliveryJson = await deliveryRes.json();
    const location = deliveryJson?.location;

    if (!location) {
      return new Response(JSON.stringify({ error: "Asset not found or not accessible." }), {
        status: 404,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    const assetRes = await fetch(location, { headers: HEADERS, redirect: "follow" });

    if (!assetRes.ok) {
      return new Response(JSON.stringify({ error: "Could not download asset from Roblox CDN." }), {
        status: 502,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    const contentType = assetRes.headers.get("content-type") || "";

    if (contentType.startsWith("image/")) {
      const buffer = await assetRes.arrayBuffer();
      return new Response(buffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    const xml = await assetRes.text();

    const urlTagMatch = xml.match(/<url>\s*(https?:\/\/[^<\s]+)\s*<\/url>/i);
    if (urlTagMatch) {
      const innerUrl = urlTagMatch[1].trim();
      const idInUrl = innerUrl.match(/[?&]id=(\d+)/i);
      if (idInUrl) return await fetchImageById(idInUrl[1]);
      return await fetchImageByUrl(innerUrl);
    }

    const rbxMatch = xml.match(/rbxassetid:\/\/(\d+)/i);
    if (rbxMatch) return await fetchImageById(rbxMatch[1]);

    const bareUrlMatch = xml.match(/https?:\/\/www\.roblox\.com\/asset\/\?id=(\d+)/i);
    if (bareUrlMatch) return await fetchImageById(bareUrlMatch[1]);

    return new Response(JSON.stringify({ error: "Not a classic clothing item." }), {
      status: 404,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Server error. Please try again." }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}

async function fetchImageById(id) {
  const deliveryRes = await fetch(
    `https://assetdelivery.roblox.com/v1/assetId/${id}`,
    { headers: HEADERS }
  );
  if (!deliveryRes.ok) return new Response(JSON.stringify({ error: "Could not fetch template image." }), { status: 502, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  const json = await deliveryRes.json();
  if (!json?.location) return new Response(JSON.stringify({ error: "Template image not found." }), { status: 404, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  return fetchImageByUrl(json.location);
}

async function fetchImageByUrl(url) {
  const imgRes = await fetch(url, { headers: HEADERS, redirect: "follow" });
  if (!imgRes.ok) return new Response(JSON.stringify({ error: "Could not fetch template image from Roblox." }), { status: 502, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
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
}
