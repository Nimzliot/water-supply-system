// Turns a picked or pasted photo into something small and easy to send: it is shrunk so its
// longer side is at most MAX_SIDE pixels, re-encoded as JPEG, and turned into base64 text.
// A 5 MB phone photo usually ends up around 150 to 300 KB.
const MAX_SIDE = 1280;
const QUALITY = 0.82;
const THUMB_SIDE = 160;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp", "image/heic", "image/heif"];
export const MAX_IMAGES = 3;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This browser cannot open that image. Try a JPEG or PNG photo."));
    };
    image.src = url;
  });
}

function draw(image, maxSide, quality) {
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  // JPEG has no transparency: paint white behind PNG cut-outs instead of black.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { dataUrl: canvas.toDataURL("image/jpeg", quality), width: canvas.width, height: canvas.height };
}

// Returns { mimeType, data (base64), preview (small data URL kept with the chat), width, height, sizeKb, name }.
export async function encodeImage(file) {
  if (!file || (!file.type.startsWith("image/") && !ACCEPTED.includes(file.type))) {
    throw new Error("Only photos and images can be added.");
  }
  if (file.size > 25 * 1024 * 1024) {
    throw new Error("That image is over 25 MB. Pick a smaller one.");
  }

  const image = await loadImage(file);
  const full = draw(image, MAX_SIDE, QUALITY);
  const thumb = draw(image, THUMB_SIDE, 0.7);
  const data = full.dataUrl.split(",")[1];

  return {
    mimeType: "image/jpeg",
    data,
    preview: thumb.dataUrl,
    width: full.width,
    height: full.height,
    sizeKb: Math.round((data.length * 3) / 4 / 1024),
    name: file.name || "image"
  };
}
