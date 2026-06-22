export default {
  async fetch(request) {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id || !/^\d+$/.test(id)) {
      return new Response(JSON.stringify({ error: 'Invalid ID' }), { status: 400 });
    }

    const thumbRes = await fetch(
      `https://thumbnails.roblox.com/v1/assets?assetIds=${id}&returnPolicy=PlaceHolder&size=420x420&format=Png&isCircular=false`
    );
    const thumbData = await thumbRes.json();
    const imageUrl = thumbData?.data?.[0]?.imageUrl;
    if (!imageUrl) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });

    const imgRes = await fetch(imageUrl);
    const blob = await imgRes.arrayBuffer();

    return new Response(blob, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="clothify-${id}.png"`,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400',
      }
    });
  }
};
