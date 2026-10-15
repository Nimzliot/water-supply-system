import { useEffect, useMemo, useRef, useState } from "react";
import { History, ImagePlus, MessageSquarePlus, Send, Sparkles, Trash2, X } from "lucide-react";
import api from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { errorMessage } from "../../lib/format";
import { MAX_IMAGES, encodeImage } from "../../lib/imageEncoding";
import AiText from "./AiText";

// Blesson AI: the Gemini chat used on its own page and in the floating bubble. Admins and
// households each get their own persona from the server; this component only changes the
// greeting and the suggested questions. Chats are kept in this browser (photos as small previews).

const MAX_CHATS = 20;
const MAX_MESSAGES = 60;

const PERSONA = {
  admin: {
    subtitle: "Operations assistant · live plant data",
    greeting: "Hi, I'm Blesson AI. I watch the controller, tank, pump, valves and schedules with you. Ask what is happening, or send a photo of the wiring, a sensor or the serial monitor and I'll help find the fault.",
    suggestions: [
      "Why is water not reaching the houses right now?",
      "Is anything wrong with the hardware?",
      "Who is close to their daily limit?",
      "Suggest better supply windows."
    ],
    placeholder: "Ask Blesson AI..."
  },
  user: {
    subtitle: "Your water helper · English or Tamil",
    greeting: "Vanakkam! I'm Blesson AI. Ask me how much water you have used, when water comes next, or about your bill. You can send a photo too, and I can answer in Tamil.",
    suggestions: [
      "How much water have I used today?",
      "When will water come next?",
      "Is my bill paid?",
      "இன்று எவ்வளவு தண்ணீர் மீதம் உள்ளது?"
    ],
    placeholder: "Ask Blesson AI..."
  }
};

const newChat = () => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title: "New chat", messages: [], updatedAt: Date.now() });

function loadChats(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveChats(key, chats) {
  try {
    localStorage.setItem(key, JSON.stringify(chats.slice(0, MAX_CHATS)));
  } catch {
    // Storage is full or blocked: the chat still works, it just is not remembered.
  }
}

export function BlessonAvatar({ size = 36 }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-rose-700 text-white shadow-sm" style={{ width: size, height: size }}>
      <Sparkles size={size * 0.5} />
    </span>
  );
}

export default function BlessonChat({ scope = "admin", variant = "page", onClose }) {
  const { user } = useAuth();
  const persona = PERSONA[scope];
  const storageKey = `blesson_chats_${scope}_${user?.id || "me"}`;

  const [chats, setChats] = useState(() => {
    const saved = loadChats(storageKey);
    return saved.length ? saved : [newChat()];
  });
  const [activeId, setActiveId] = useState(() => chats[0]?.id);
  const [question, setQuestion] = useState("");
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [encoding, setEncoding] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef(null);
  const end = useRef(null);
  const input = useRef(null);

  const active = useMemo(() => chats.find((chat) => chat.id === activeId) || chats[0], [chats, activeId]);

  useEffect(() => {
    api.get(`/${scope}/ai/status`).then(({ data }) => setStatus(data.ai)).catch(() => setStatus({ configured: false }));
  }, [scope]);

  useEffect(() => {
    // Empty chats are not worth remembering.
    saveChats(storageKey, chats.filter((chat) => chat.messages.length));
  }, [chats, storageKey]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [active?.messages.length, busy]);

  const updateChat = (id, change) => setChats((current) => current.map((chat) => (chat.id === id ? { ...chat, ...change(chat), updatedAt: Date.now() } : chat)));

  const startNewChat = () => {
    setError("");
    setQuestion("");
    setImages([]);
    setShowHistory(false);
    if (active && !active.messages.length) return;
    const chat = newChat();
    setChats((current) => [chat, ...current].slice(0, MAX_CHATS));
    setActiveId(chat.id);
    input.current?.focus();
  };

  const deleteChat = (id) => {
    setChats((current) => {
      const left = current.filter((chat) => chat.id !== id);
      const next = left.length ? left : [newChat()];
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
  };

  const addFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter((file) => file.type.startsWith("image/"));
    if (!files.length) return;
    setError("");
    const room = MAX_IMAGES - images.length;
    if (room <= 0) return setError(`You can add up to ${MAX_IMAGES} images to one message.`);
    setEncoding(true);
    try {
      const encoded = [];
      for (const file of files.slice(0, room)) encoded.push(await encodeImage(file));
      setImages((current) => [...current, ...encoded].slice(0, MAX_IMAGES));
      if (files.length > room) setError(`Only ${MAX_IMAGES} images fit in one message; the rest were left out.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setEncoding(false);
    }
  };

  const send = async (text = question) => {
    const asked = text.trim();
    if ((!asked && !images.length) || busy || !active) return;
    const chatId = active.id;
    const sentImages = images;
    const history = active.messages.map(({ role, text: said }) => ({ role, text: said || "(photo)" }));

    updateChat(chatId, (chat) => ({
      title: chat.messages.length ? chat.title : (asked || "Photo").slice(0, 48),
      messages: [...chat.messages, { role: "user", text: asked, images: sentImages.map((image) => image.preview) }].slice(-MAX_MESSAGES)
    }));
    setQuestion("");
    setImages([]);
    setError("");
    setBusy(true);

    try {
      const { data } = await api.post(`/${scope}/ai/ask`, {
        question: asked,
        images: sentImages.map(({ mimeType, data: base64 }) => ({ mimeType, data: base64 })),
        history
      });
      updateChat(chatId, (chat) => ({ messages: [...chat.messages, { role: "model", text: data.answer }].slice(-MAX_MESSAGES) }));
    } catch (err) {
      setError(errorMessage(err, "Blesson AI could not answer."));
      // Put the question back so nothing typed is lost.
      updateChat(chatId, (chat) => ({ messages: chat.messages.slice(0, -1) }));
      setQuestion(asked);
      setImages(sentImages);
    } finally {
      setBusy(false);
    }
  };

  const notReady = status && !status.configured;
  const page = variant === "page";
  const sortedChats = chats.filter((chat) => chat.messages.length).sort((a, b) => b.updatedAt - a.updatedAt);

  const historyList = (
    <div className="space-y-1">
      {sortedChats.map((chat) => (
        <div key={chat.id} className={`group flex items-center gap-1 rounded-xl ${chat.id === active?.id ? "bg-brand-50" : "hover:bg-slate-50"}`}>
          <button
            type="button"
            onClick={() => {
              setActiveId(chat.id);
              setShowHistory(false);
            }}
            className={`min-w-0 flex-1 truncate px-3 py-2.5 text-left text-sm ${chat.id === active?.id ? "font-bold text-brand-700" : "text-slate-600"}`}
          >
            {chat.title}
          </button>
          <button type="button" onClick={() => deleteChat(chat.id)} className="mr-1 rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-red-600" aria-label={`Delete chat ${chat.title}`}>
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      {!sortedChats.length ? <p className="px-3 py-2 text-sm text-slate-400">No saved chats yet.</p> : null}
    </div>
  );

  return (
    <div className={page ? "grid gap-4 lg:grid-cols-[16rem_1fr]" : "flex h-full flex-col"}>
      {page ? (
        <aside className="panel hidden self-start p-3 lg:block">
          <button type="button" onClick={startNewChat} className="btn-primary mb-3 flex w-full items-center justify-center gap-2">
            <MessageSquarePlus size={17} /> New chat
          </button>
          <p className="px-3 pb-1 text-[0.7rem] font-bold uppercase tracking-wider text-slate-400">Recent</p>
          {historyList}
        </aside>
      ) : null}

      <section
        className={`relative flex min-h-0 flex-col ${page ? "panel h-[calc(100vh-15rem)] min-h-[32rem]" : "h-full"} ${dragging ? "ring-2 ring-brand-400" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(event.dataTransfer.files);
        }}
      >
        <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <BlessonAvatar />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold text-ink">Blesson AI</p>
            <p className="truncate text-xs text-slate-500">{persona.subtitle}</p>
          </div>
          <button type="button" onClick={() => setShowHistory((current) => !current)} className={`flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 ${page ? "lg:hidden" : ""}`} aria-label="Chat history">
            <History size={18} />
          </button>
          <button type="button" onClick={startNewChat} className={`flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold text-brand-600 hover:bg-brand-50 ${page ? "lg:hidden" : ""}`} aria-label="New chat">
            <MessageSquarePlus size={17} />
            <span className="hidden sm:inline">New chat</span>
          </button>
          {onClose ? (
            <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Close Blesson AI">
              <X size={18} />
            </button>
          ) : null}
        </header>

        {showHistory ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <button type="button" onClick={startNewChat} className="btn-primary mb-3 flex w-full items-center justify-center gap-2">
              <MessageSquarePlus size={17} /> New chat
            </button>
            {historyList}
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {!active?.messages.length ? (
              <div className="pop-in">
                <div className="flex gap-2.5">
                  <BlessonAvatar size={30} />
                  <div className="max-w-[90%] rounded-2xl rounded-tl-md bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">{persona.greeting}</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 pl-10">
                  {persona.suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => send(suggestion)}
                      disabled={notReady || busy}
                      className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-left text-xs font-semibold text-slate-700 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {active?.messages.map((message, index) =>
              message.role === "user" ? (
                <div key={index} className="ml-auto flex w-fit max-w-[85%] flex-col items-end gap-1.5">
                  {message.images?.length ? (
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {message.images.map((preview, imageIndex) => (
                        <img key={imageIndex} src={preview} alt="Sent to Blesson AI" className="h-24 w-24 rounded-xl object-cover shadow-sm" />
                      ))}
                    </div>
                  ) : null}
                  {message.text ? <div className="whitespace-pre-wrap rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-sm text-white">{message.text}</div> : null}
                </div>
              ) : (
                <div key={index} className="pop-in flex gap-2.5">
                  <BlessonAvatar size={30} />
                  <div className="min-w-0 max-w-[90%] rounded-2xl rounded-tl-md bg-slate-50 px-4 py-3">
                    <AiText text={message.text} />
                  </div>
                </div>
              )
            )}

            {busy ? (
              <div className="flex gap-2.5">
                <BlessonAvatar size={30} />
                <div className="flex items-center gap-1.5 rounded-2xl bg-slate-50 px-4 py-3" aria-label="Blesson AI is thinking">
                  {[0, 1, 2].map((dot) => (
                    <span key={dot} className="h-2 w-2 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: `${dot * 0.15}s` }} />
                  ))}
                </div>
              </div>
            ) : null}
            <div ref={end} />
          </div>
        )}

        {dragging ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-brand-50/80 text-sm font-bold text-brand-700">Drop the photo to add it</div>
        ) : null}

        <div className="border-t border-slate-100 p-3">
          {notReady ? (
            <p className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {scope === "admin" ? status.help || "Blesson AI is not set up on the server yet." : "Blesson AI is not switched on yet. Please ask your administrator."}
            </p>
          ) : null}
          {error ? <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}

          {images.length || encoding ? (
            <div className="mb-2 flex flex-wrap gap-2">
              {images.map((image, index) => (
                <div key={index} className="relative">
                  <img src={image.preview} alt={image.name} className="h-16 w-16 rounded-xl object-cover" />
                  <span className="absolute bottom-0.5 left-0.5 rounded bg-ink/70 px-1 text-[0.6rem] font-bold text-white">{image.sizeKb} KB</span>
                  <button
                    type="button"
                    onClick={() => setImages((current) => current.filter((_, i) => i !== index))}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-white"
                    aria-label="Remove image"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {encoding ? <div className="flex h-16 w-16 animate-pulse items-center justify-center rounded-xl bg-slate-100 text-[0.65rem] font-bold text-slate-500">Encoding...</div> : null}
            </div>
          ) : null}

          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={notReady || images.length >= MAX_IMAGES}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:border-brand-200 hover:text-brand-600 disabled:opacity-40"
              aria-label="Add a photo"
              title="Add a photo (or paste / drop one)"
            >
              <ImagePlus size={19} />
            </button>
            <textarea
              ref={input}
              rows={1}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              onPaste={(event) => {
                if (event.clipboardData?.files?.length) {
                  event.preventDefault();
                  addFiles(event.clipboardData.files);
                }
              }}
              placeholder={persona.placeholder}
              maxLength={2000}
              className="input max-h-32 min-h-[2.75rem] flex-1 resize-none py-2.5"
              aria-label="Message to Blesson AI"
            />
            <button type="submit" disabled={busy || encoding || notReady || (!question.trim() && !images.length)} className="btn-primary h-11 shrink-0 px-3.5 disabled:opacity-50" aria-label="Send">
              <Send size={18} />
            </button>
          </form>
          <p className="mt-1.5 text-center text-[0.65rem] text-slate-400">Blesson AI reads live data and can make mistakes. It never switches the pump or valves.</p>
        </div>
      </section>
    </div>
  );
}
