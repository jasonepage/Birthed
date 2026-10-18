import sys, base64, asyncio
from playwright.async_api import async_playwright
font = base64.b64encode(open("fraunces.woff2","rb").read()).decode()

def page(img, W, H, layout):
    bg = base64.b64encode(open(img,"rb").read()).decode()
    if layout == "bottom":
        css = f"""
        .wm{{position:absolute;left:0;right:0;top:{H*0.745}px;text-align:center;font-size:{H*0.125}px;font-weight:650;color:#EF5680;letter-spacing:-0.01em;text-shadow:0 {H*0.01}px {H*0.05}px rgba(0,0,0,.6)}}
        .tg{{position:absolute;left:0;right:0;top:{H*0.89}px;text-align:center;font-size:{H*0.042}px;font-weight:420;color:#FFF1C2;opacity:.92;letter-spacing:0.01em}}"""
    else:
        css = f"""
        .wm{{position:absolute;left:{W*0.60}px;top:{H*0.30}px;font-size:{H*0.21}px;font-weight:650;color:#EF5680;letter-spacing:-0.015em;line-height:1;text-shadow:0 {H*0.01}px {H*0.05}px rgba(0,0,0,.6)}}
        .tg{{position:absolute;left:{W*0.605}px;top:{H*0.56}px;font-size:{H*0.062}px;font-weight:420;color:#FFF1C2;opacity:.92;line-height:1.2}}"""
    return f"""<html><head><style>
    @font-face{{font-family:Fr;src:url(data:font/woff2;base64,{font}) format('woff2');font-weight:100 900}}
    body{{margin:0;width:{W}px;height:{H}px;background:url(data:image/png;base64,{bg}) 0 0/{W}px {H}px no-repeat;font-family:Fr;position:relative;overflow:hidden}}
    {css}</style></head><body><div class="wm">Birthed</div><div class="tg">Every date has a hive.</div></body></html>"""

async def main(img, out, W, H, layout):
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={"width":W,"height":H})
        await pg.set_content(page(img, W, H, layout)); await pg.evaluate("document.fonts.ready"); await pg.wait_for_timeout(500)
        await pg.screenshot(path=out, clip={"x":0,"y":0,"width":W,"height":H}); await b.close()
asyncio.run(main(sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]))
