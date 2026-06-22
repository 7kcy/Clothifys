export default async function handler(req, res) {
  const { id } = req.query;

  if (!id || !/^\d+$/.test(id)) {
    return res.status(400).json({ error: "Invalid asset ID." });
  }

  try {
    // Step 1: Fetch the XML from Roblox to get the ShirtTemplate URL
    const assetRes = await fetch(`https://www.roblox.com/asset/?id=${id}`, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
      redirect: "follow",
    });

    if (!assetRes.ok) {
      return res.status(502).json({ error: "Could not reach Roblox API." });
    }

    const contentType = assetRes.headers.get("content-type") || "";

    // If Roblox returned an image directly (some asset IDs do), pipe it straight through
    if (contentType.includes("image/png") || contentType.includes("image/jpeg") || contentType.includes("image/")) {
      const buffer = await assetRes.arrayBuffer();
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.status(200).send(Buffer.from(buffer));
    }

    const xml = await assetRes.text();

    // Step 2: Parse the XML to find the ShirtTemplate or PantsTemplate URL
    const urlMatch = xml.match(/<url>\s*(https?:\/\/[^<]+)\s*<\/url>/i);
    if (!urlMatch) {
      // Try to find rbxassetid style
      const rbxMatch = xml.match(/rbxassetid:\/\/(\d+)/i);
      if (rbxMatch) {
        return fetchAndSendImage(`https://www.roblox.com/asset/?id=${rbxMatch[1]}`, res);
      }
      return res.status(404).json({ error: "Not a classic clothing item, or the item is restricted." });
    }

    const templateUrl = urlMatch[1].trim();
    return await fetchAndSendImage(templateUrl, res);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error. Please try again." });
  }
}

async function fetchAndSendImage(url, res) {
  const imgRes = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    redirect: "follow",
  });

  if (!imgRes.ok) {
    return res.status(502).json({ error: "Could not fetch the template image from Roblox." });
  }

  const buffer = await imgRes.arrayBuffer();
  const contentType = imgRes.headers.get("content-type") || "image/png";

  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");
  return res.status(200).send(Buffer.from(buffer));
}
