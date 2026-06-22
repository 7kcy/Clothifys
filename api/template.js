const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { id } = req.query;
  if (!id || !/^\d+$/.test(id)) {
    return res.status(400).json({ error: "Invalid asset ID." });
  }

  try {
    // Step 1: Use assetdelivery API to get the CDN location for the asset XML
    const deliveryRes = await fetch(
      `https://assetdelivery.roblox.com/v1/assetId/${id}`,
      { headers: HEADERS }
    );

    if (!deliveryRes.ok) {
      return res.status(502).json({ error: "Could not reach Roblox. Try again shortly." });
    }

    const deliveryJson = await deliveryRes.json();
    const location = deliveryJson?.location;

    if (!location) {
      return res.status(404).json({ error: "Asset not found or not accessible." });
    }

    // Step 2: Fetch the actual asset from the CDN location
    const assetRes = await fetch(location, { headers: HEADERS, redirect: "follow" });

    if (!assetRes.ok) {
      return res.status(502).json({ error: "Could not download asset from Roblox CDN." });
    }

    const contentType = assetRes.headers.get("content-type") || "";

    // If the CDN returned an image directly, send it
    if (contentType.startsWith("image/")) {
      const buffer = await assetRes.arrayBuffer();
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.status(200).send(Buffer.from(buffer));
    }

    // Otherwise it's XML — parse out the ShirtTemplate/PantsTemplate URL
    const xml = await assetRes.text();

    const urlMatch = xml.match(/<url>\s*(https?:\/\/[^<\s]+)\s*<\/url>/i);
    if (!urlMatch) {
      const rbxMatch = xml.match(/rbxassetid:\/\/(\d+)/i);
      if (rbxMatch) {
        return fetchImageById(rbxMatch[1], res);
      }
      return res.status(404).json({ error: "Not a classic clothing item. Only shirts and pants are supported." });
    }

    const templateUrl = urlMatch[1].trim();
    return await fetchImageByUrl(templateUrl, res);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error. Please try again." });
  }
}

async function fetchImageById(id, res) {
  const deliveryRes = await fetch(
    `https://assetdelivery.roblox.com/v1/assetId/${id}`,
    { headers: HEADERS }
  );
  if (!deliveryRes.ok) return res.status(502).json({ error: "Could not fetch template image." });
  const json = await deliveryRes.json();
  if (!json?.location) return res.status(404).json({ error: "Template image not found." });
  return fetchImageByUrl(json.location, res);
}

async function fetchImageByUrl(url, res) {
  const imgRes = await fetch(url, { headers: HEADERS, redirect: "follow" });
  if (!imgRes.ok) return res.status(502).json({ error: "Could not fetch template image from Roblox." });
  const buffer = await imgRes.arrayBuffer();
  const contentType = imgRes.headers.get("content-type") || "image/png";
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=86400");
  return res.status(200).send(Buffer.from(buffer));
}
