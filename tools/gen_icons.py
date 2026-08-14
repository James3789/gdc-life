"""PWA 아이콘 생성 스크립트 (1회성).

실행:
    pip install pillow
    python tools/gen_icons.py

frontend/public/icons/ 에 PNG 아이콘을 생성한다.
로고 교체 시 BRAND 색상과 draw_mark() 만 수정하면 된다.
"""

from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / "frontend" / "public" / "icons"
BRAND = (11, 114, 133, 255)  # #0b7285
WHITE = (255, 255, 255, 255)


def draw_mark(size: int, *, inset: float = 0.0) -> Image.Image:
    """경로(route) 마크: 출발점 → 곡선 → 도착점."""
    s = 512
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 배경 라운드 사각형 (maskable 용은 inset 없이 풀블리드)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=BRAND)

    # 마크는 안전영역(중앙 80%) 안에 두어 maskable 크롭에도 잘리지 않게
    k = 1.0 - inset
    cx = cy = s / 2

    def p(x: float, y: float) -> tuple[float, float]:
        return (cx + (x - cx) * k, cy + (y - cy) * k)

    path = [p(160, 372), p(232, 372), p(288, 300), p(288, 212), p(352, 160)]
    d.line(path, fill=WHITE, width=int(34 * k), joint="curve")

    for x, y, r in ((160, 372, 46), (352, 160, 46)):
        px, py = p(x, y)
        rr = r * k
        d.ellipse([px - rr, py - rr, px + rr, py + rr], fill=BRAND, outline=WHITE, width=int(30 * k))

    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    draw_mark(192).save(OUT / "icon-192.png")
    draw_mark(512).save(OUT / "icon-512.png")
    draw_mark(180).save(OUT / "apple-touch-icon.png")
    # maskable: 원형 크롭을 대비해 마크를 20% 축소
    draw_mark(512, inset=0.22).save(OUT / "icon-maskable-512.png")
    print(f"생성 완료 → {OUT}")


if __name__ == "__main__":
    main()
