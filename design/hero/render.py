import sys, asyncio
from playwright.async_api import async_playwright

async def main(svg_path, out_path, W, H):
    svg = open(svg_path).read()
    html = f"<html><body style='margin:0;background:#000'>{svg}</body></html>"
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
        await pg.set_content(html)
        await pg.wait_for_timeout(500)
        await pg.screenshot(path=out_path, clip={"x": 0, "y": 0, "width": W, "height": H})
        await b.close()

asyncio.run(main(sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])))
