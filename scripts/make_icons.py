import os
import subprocess
from PIL import Image, ImageDraw, ImageFilter

def create_app_icon():
    # 1024 x 1024 canvas
    size = 1024
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Squircle parameters for macOS
    margin = 88
    box = [margin, margin, size - margin, size - margin]
    radius = 190

    # Draw subtle drop shadow for squircle
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow)
    s_draw.rounded_rectangle([margin, margin + 14, size - margin, size - margin + 14], radius=radius, fill=(0, 0, 0, 110))
    shadow = shadow.filter(ImageFilter.GaussianBlur(24))
    img = Image.alpha_composite(shadow, img)
    draw = ImageDraw.Draw(img)

    # Base squircle with vertical metallic gradient
    for y in range(margin, size - margin):
        ratio = (y - margin) / (size - 2 * margin)
        # dark titanium slate gradient
        r = int(24 * (1 - ratio) + 12 * ratio)
        g = int(28 * (1 - ratio) + 14 * ratio)
        b = int(34 * (1 - ratio) + 18 * ratio)
        # Draw 1px slice constrained by mask
        pass

    # Draw body
    body = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    b_draw = ImageDraw.Draw(body)
    b_draw.rounded_rectangle(box, radius=radius, fill=(18, 21, 26, 255), outline=(52, 60, 72, 255), width=3)
    
    # Subtle inner border glow
    b_draw.rounded_rectangle([margin + 4, margin + 4, size - margin - 4, size - margin - 4], radius=radius - 4, outline=(34, 40, 50, 255), width=2)
    img = Image.alpha_composite(img, body)
    draw = ImageDraw.Draw(img)

    # Inner display screen (inset)
    s_box = [margin + 56, margin + 80, size - margin - 56, size - margin - 80]
    draw.rounded_rectangle(s_box, radius=42, fill=(8, 10, 13, 255), outline=(28, 34, 42, 255), width=3)

    # Draw grid texture on screen
    grid_color = (18, 22, 28, 255)
    for gx in range(s_box[0] + 20, s_box[2] - 20, 28):
        draw.line([(gx, s_box[1] + 16), (gx, s_box[3] - 16)], fill=grid_color, width=1)
    for gy in range(s_box[1] + 16, s_box[3] - 16, 28):
        draw.line([(s_box[0] + 16, gy), (s_box[2] - 16, gy)], fill=grid_color, width=1)

    # Header in display screen
    # Draw status LED at top left
    draw.ellipse([s_box[0] + 36, s_box[1] + 32, s_box[0] + 48, s_box[1] + 44], fill=(235, 77, 56, 255))
    # Draw mini title bars
    draw.rounded_rectangle([s_box[0] + 60, s_box[1] + 36, s_box[0] + 160, s_box[1] + 40], radius=2, fill=(90, 100, 115, 255))

    # Dot-matrix clock digits in center
    # 5x7 dot matrix font for '1', '2', ':', '0', '0'
    FONT_5x7 = {
        '1': [
            "  #  ",
            " ##  ",
            "  #  ",
            "  #  ",
            "  #  ",
            "  #  ",
            " ### "
        ],
        '2': [
            " ### ",
            "#   #",
            "    #",
            "  ## ",
            " #   ",
            "#    ",
            "#####"
        ],
        ':': [
            "     ",
            "  #  ",
            "     ",
            "     ",
            "  #  ",
            "     ",
            "     "
        ],
        '0': [
            " ### ",
            "#   #",
            "#  ##",
            "# # #",
            "##  #",
            "#   #",
            " ### "
        ]
    }

    text = "12:00"
    dot_radius = 9
    dot_spacing = 24
    start_x = s_box[0] + 90
    start_y = s_box[1] + 160

    # Glow layer for lit dots
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(glow)

    cur_x = start_x
    for ch in text:
        bitmap = FONT_5x7[ch]
        cols = 3 if ch == ':' else 5
        for r_idx, row in enumerate(bitmap):
            for c_idx in range(cols):
                cx = cur_x + c_idx * dot_spacing
                cy = start_y + r_idx * dot_spacing
                is_lit = (row[c_idx] == '#') if c_idx < len(row) else False
                
                if is_lit:
                    # draw glow
                    g_draw.ellipse([cx - dot_radius - 8, cy - dot_radius - 8, cx + dot_radius + 8, cy + dot_radius + 8], fill=(245, 158, 11, 70))
                    # draw core
                    draw.ellipse([cx - dot_radius, cy - dot_radius, cx + dot_radius, cy + dot_radius], fill=(255, 180, 40, 255))
                    draw.ellipse([cx - dot_radius + 3, cy - dot_radius + 3, cx + dot_radius - 3, cy + dot_radius - 3], fill=(255, 240, 160, 255))
                else:
                    # unlit dot
                    draw.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=(22, 27, 34, 255))
        cur_x += (cols + 1) * dot_spacing

    glow = glow.filter(ImageFilter.GaussianBlur(12))
    img = Image.alpha_composite(glow, img)
    draw = ImageDraw.Draw(img)

    # Bottom ECG pulse wave
    wave_y = s_box[3] - 90
    wave_points = [
        (s_box[0] + 50, wave_y),
        (s_box[0] + 180, wave_y),
        (s_box[0] + 220, wave_y - 20),
        (s_box[0] + 250, wave_y + 35),
        (s_box[0] + 290, wave_y - 75),
        (s_box[0] + 340, wave_y + 45),
        (s_box[0] + 370, wave_y - 15),
        (s_box[0] + 410, wave_y),
        (s_box[2] - 50, wave_y)
    ]
    # Draw glow for wave
    for i in range(len(wave_points) - 1):
        draw.line([wave_points[i], wave_points[i+1]], fill=(245, 158, 11, 230), width=6)
        draw.line([wave_points[i], wave_points[i+1]], fill=(255, 220, 120, 255), width=2)

    return img

def create_mac_tray_icon(scale=1):
    # scale 1: 22x22, scale 2: 44x44
    dim = 22 * scale
    # Supersample 4x for crystal clear antialiasing
    super_dim = dim * 4
    img = Image.new("RGBA", (super_dim, super_dim), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    center = super_dim / 2
    # Clock circle
    radius = 7.5 * scale * 4
    width = int(1.6 * scale * 4)

    # Outer clock body
    bbox = [center - radius, center - radius, center + radius, center + radius]
    draw.ellipse(bbox, outline=(0, 0, 0, 255), width=width)

    # Top clock crown
    crown_w = int(2.5 * scale * 4)
    crown_h = int(1.8 * scale * 4)
    crown_y = center - radius - crown_h + int(0.5 * scale * 4)
    draw.rounded_rectangle([center - crown_w, crown_y, center + crown_w, crown_y + crown_h], radius=int(0.8*scale*4), fill=(0, 0, 0, 255))

    # Center pin
    pin_r = 1.6 * scale * 4
    draw.ellipse([center - pin_r, center - pin_r, center + pin_r, center + pin_r], fill=(0, 0, 0, 255))

    # Hour hand (pointing to 10:10 -> hour hand angle ~300 deg, dx < 0, dy < 0)
    import math
    h_angle = math.radians(305)
    h_len = radius * 0.48
    hx = center + h_len * math.sin(h_angle)
    hy = center - h_len * math.cos(h_angle)
    draw.line([(center, center), (hx, hy)], fill=(0, 0, 0, 255), width=int(1.7 * scale * 4))

    # Minute hand (pointing to ~10 -> 60 deg, dx > 0, dy < 0)
    m_angle = math.radians(55)
    m_len = radius * 0.72
    mx = center + m_len * math.sin(m_angle)
    my = center - m_len * math.cos(m_angle)
    draw.line([(center, center), (mx, my)], fill=(0, 0, 0, 255), width=int(1.7 * scale * 4))

    # Downscale smoothly to target dimension
    return img.resize((dim, dim), Image.Resampling.LANCZOS)

def create_win_tray_icon(dim=32):
    # High-contrast, sharp color icon for Windows System Tray (dark & light taskbars)
    super_dim = dim * 4
    img = Image.new("RGBA", (super_dim, super_dim), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    center = super_dim / 2
    radius = (dim * 0.38) * 4
    width = int(max(1.8, dim * 0.08) * 4)

    # Dial background: subtle dark circle with contrast
    bbox = [center - radius, center - radius, center + radius, center + radius]
    draw.ellipse(bbox, fill=(16, 20, 26, 255), outline=(220, 226, 235, 255), width=width)

    # Top crown
    crown_w = int(radius * 0.35)
    crown_h = int(radius * 0.22)
    crown_y = center - radius - crown_h + int(1 * 4)
    draw.rounded_rectangle([center - crown_w, crown_y, center + crown_w, crown_y + crown_h], radius=int(1*4), fill=(245, 158, 11, 255))

    # Center pin (Amber core)
    pin_r = int(radius * 0.18)
    draw.ellipse([center - pin_r, center - pin_r, center + pin_r, center + pin_r], fill=(245, 158, 11, 255))

    # Hour hand (white with crisp edge)
    import math
    h_angle = math.radians(305)
    h_len = radius * 0.48
    hx = center + h_len * math.sin(h_angle)
    hy = center - h_len * math.cos(h_angle)
    draw.line([(center, center), (hx, hy)], fill=(255, 255, 255, 255), width=int(max(1.8, dim * 0.08) * 4))

    # Minute hand (Amber neon)
    m_angle = math.radians(55)
    m_len = radius * 0.72
    mx = center + m_len * math.sin(m_angle)
    my = center - m_len * math.cos(m_angle)
    draw.line([(center, center), (mx, my)], fill=(245, 158, 11, 255), width=int(max(1.8, dim * 0.08) * 4))

    return img.resize((dim, dim), Image.Resampling.LANCZOS)

def main():
    os.makedirs("build", exist_ok=True)
    os.makedirs("assets", exist_ok=True)

    print("1. Generating 1024x1024 master app icon...")
    app_icon = create_app_icon()
    app_icon.save("build/icon.png")

    print("2. Generating macOS .icns via iconutil...")
    iconset_dir = "build/icon.iconset"
    os.makedirs(iconset_dir, exist_ok=True)
    sizes = [16, 32, 64, 128, 256, 512]
    for s in sizes:
        resized = app_icon.resize((s, s), Image.Resampling.LANCZOS)
        resized.save(f"{iconset_dir}/icon_{s}x{s}.png")
        resized2x = app_icon.resize((s * 2, s * 2), Image.Resampling.LANCZOS)
        resized2x.save(f"{iconset_dir}/icon_{s}x{s}@2x.png")
    app_icon.save(f"{iconset_dir}/icon_512x512@2x.png")

    subprocess.run(["iconutil", "-c", "icns", iconset_dir, "-o", "build/icon.icns"], check=True)
    print("   Created build/icon.icns successfully.")

    print("3. Generating Windows .ico...")
    win_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    app_icon.save("build/icon.ico", format="ICO", sizes=win_sizes)
    print("   Created build/icon.ico successfully.")

    print("4. Generating Mac Menu Bar Tray icons (22x22 and 44x44 Retina)...")
    tray_1x = create_mac_tray_icon(1)
    tray_2x = create_mac_tray_icon(2)
    tray_1x.save("assets/trayTemplate.png")
    tray_2x.save("assets/trayTemplate@2x.png")
    print("   Created assets/trayTemplate.png & trayTemplate@2x.png.")

    print("5. Generating Windows crisp Tray icons (multi-DPI)...")
    win_tray_32 = create_win_tray_icon(32)
    win_tray_64 = create_win_tray_icon(64)
    win_tray_32.save("assets/tray-win.png")
    win_tray_64.save("assets/tray-win@2x.png")
    
    win_tray_sizes = [(16, 16), (20, 20), (24, 24), (32, 32), (48, 48), (64, 64)]
    win_tray_master = create_win_tray_icon(64)
    win_tray_master.save("assets/tray-win.ico", format="ICO", sizes=win_tray_sizes)
    print("   Created assets/tray-win.png and assets/tray-win.ico.")

    print("All icons generated with high precision!")

if __name__ == "__main__":
    main()
