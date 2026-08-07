// Generate 6 simple placeholder showcase PNGs using sharp
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const OUT = path.join(process.cwd(), "public", "generated", "showcase");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const items = [
  { id: "neon-dreams", color: { r: 16, g: 185, b: 129 } },
  { id: "ocean-whisper", color: { r: 14, g: 165, b: 233 } },
  { id: "cosmic-voyage", color: { r: 20, g: 184, b: 166 } },
  { id: "urban-pulse", color: { r: 6, g: 182, b: 212 } },
  { id: "forest-spirit", color: { r: 34, g: 197, b: 94 } },
  { id: "solar-flare", color: { r: 59, g: 130, b: 246 } },
];

async function main() {
  for (const item of items) {
    const out = path.join(OUT, `${item.id}.png`);
    if (fs.existsSync(out)) { console.log(`skip: ${item.id}`); continue; }
    // Create SVG with gradient
    const svg = `<svg width="1344" height="768" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="rgb(${item.color.r},${item.color.g},${item.color.b})"/>
        <stop offset="100%" stop-color="#1e293b"/>
      </linearGradient></defs>
      <rect width="1344" height="768" fill="url(#g)"/>
    </svg>`;
    await sharp(Buffer.from(svg)).png().toFile(out);
    console.log(`created: ${item.id}`);
  }
  console.log("done");
}
main().catch(e => { console.error(e); process.exit(1); });
