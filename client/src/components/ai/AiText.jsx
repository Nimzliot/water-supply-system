// Shows a Gemini reply: paragraphs, "-" or "*" bullet lists, and **bold**. Built from React
// elements, never raw HTML, so nothing in a reply can run in the page.
function inline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={index} className="font-bold text-ink">{part.slice(2, -2)}</strong> : part.replace(/^#+\s*/, "")
  );
}

export default function AiText({ text }) {
  const blocks = [];
  for (const raw of String(text || "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    const last = blocks[blocks.length - 1];
    if (bullet) {
      if (last?.type === "list") last.items.push(bullet[1]);
      else blocks.push({ type: "list", items: [bullet[1]] });
    } else {
      blocks.push({ type: "p", text: line });
    }
  }

  return (
    <div className="space-y-2 text-sm leading-relaxed text-slate-700">
      {blocks.map((block, index) =>
        block.type === "list" ? (
          <ul key={index} className="space-y-1.5">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                <span className="min-w-0">{inline(item)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={index}>{inline(block.text)}</p>
        )
      )}
    </div>
  );
}
