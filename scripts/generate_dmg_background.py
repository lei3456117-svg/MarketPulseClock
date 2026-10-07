from PIL import Image, ImageDraw, ImageFont

# Canvas: 640 x 510 @2x -> 1280 x 1020
W, H = 1280, 1020
img = Image.new('RGBA', (W, H), (246, 248, 252, 255))
draw = ImageDraw.Draw(img)

# Dot Grid
grid_step = 40
dot_color = (226, 232, 240, 255)
for x in range(20, W, grid_step):
    for y in range(20, H, grid_step):
        draw.ellipse([x - 1, y - 1, x + 1, y + 1], fill=dot_color)

# Fonts
font_zh_title = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Unicode.ttf", 30)
font_zh_sub = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Unicode.ttf", 22)
font_zh_drag = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Unicode.ttf", 24)

# 1. Top Card: Quick Helper area
# In 1x coords: x: 30 to 610, y: 20 to 160 (height: 140)
# Icon at x=110, y=70 (fits completely inside with 40px margins)
helper_box = [60, 40, 1220, 320]
draw.rounded_rectangle(helper_box, radius=24, fill=(255, 255, 255, 240), outline=(226, 232, 240, 255), width=3)

# Inside top card:
draw.text((360, 115), "遇到「无法验证」或「安全策略拦截」？", fill=(30, 41, 59, 255), font=font_zh_title)
draw.text((360, 185), "双击左侧「一键信任」脚本，即可秒速解除限制", fill=(100, 116, 139, 255), font=font_zh_sub)

# 2. Main Drag Card (App -> Applications)
# In 1x coords: y from 180 to 480 (height: 300)
drag_box = [60, 360, 1220, 960]
draw.rounded_rectangle(drag_box, radius=32, fill=(255, 255, 255, 250), outline=(226, 232, 240, 255), width=3)

# Sleek Arrow in center of drag card (between x=340 and x=940, y=630)
arrow_color = (99, 102, 241, 220)
y_mid = 630
draw.line([(570, y_mid), (690, y_mid)], fill=arrow_color, width=10)
draw.polygon([(680, y_mid - 24), (720, y_mid), (680, y_mid + 24)], fill=arrow_color)

# Bottom text inside drag box
draw.text((410, 890), "拖动「像素时钟」到「Applications」完成安装", fill=(148, 163, 184, 255), font=font_zh_drag)

# Save
img_2x = img
img_1x = img.resize((640, 510), Image.Resampling.LANCZOS)

img_1x.save("build/dmg-bg-1x.png")
img_2x.save("build/dmg-bg-2x.png")
