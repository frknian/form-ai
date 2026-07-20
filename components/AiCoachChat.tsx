"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";

const suggestions = ["Bugünkü programımı özetle", "Bu hareketi nasıl kolaylaştırırım?", "Dinlenme sürem uygun mu?"];

export function AiCoachChat({ context }: { context: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat", body: { context } }), [context]);
  const { messages, sendMessage, status, error, stop } = useChat({ transport });
  const busy = status === "submitted" || status === "streaming";

  function closeCoach() {
    setOpen(false);
    window.requestAnimationFrame(() => launcherRef.current?.focus());
  }

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        window.requestAnimationFrame(() => launcherRef.current?.focus());
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function send(text: string) {
    const value = text.trim().slice(0, 600);
    if (!value || busy) return;
    void sendMessage({ text: value });
    setInput("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send(input);
  }

  return <>
    <button ref={launcherRef} type="button" className={`coach-launcher ${open ? "active" : ""}`} aria-label={open ? "AI koçu kapat" : "AI koça sor"} aria-expanded={open} aria-controls="ai-coach-panel" onClick={() => setOpen((current) => !current)}><span aria-hidden="true">✦</span><strong>AI Koç</strong></button>
    {open && <aside id="ai-coach-panel" className="coach-chat" role="dialog" aria-modal="false" aria-labelledby="ai-coach-title">
      <header><div><span className="coach-online" aria-hidden="true" /><div><strong id="ai-coach-title">form.ai koç</strong><small>Programını bilen asistan</small></div></div><button type="button" aria-label="AI koçu kapat" onClick={closeCoach}>×</button></header>
      <Conversation className="coach-conversation"><ConversationContent className="coach-messages">
        {messages.length === 0 ? <ConversationEmptyState title="Sana nasıl yardımcı olayım?" description="Programın, ekipmanların ve ilerlemen hakkında sorabilirsin." icon={<span className="coach-empty-icon">✦</span>} /> : messages.map((message) => <Message from={message.role} key={message.id}><MessageContent>{message.parts.map((part, index) => part.type === "text" ? <MessageResponse key={`${message.id}-${index}`}>{part.text}</MessageResponse> : null)}</MessageContent></Message>)}
        {busy && <div className="coach-thinking" role="status"><i /><i /><i /><span>Koç düşünüyor</span></div>}
        {error && <div className="coach-error" role="alert">AI koça şu anda ulaşılamıyor. Biraz sonra yeniden deneyebilirsin.</div>}
      </ConversationContent><ConversationScrollButton aria-label="Son mesaja git" /></Conversation>
      {messages.length === 0 && <div className="coach-suggestions">{suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => send(suggestion)}>{suggestion}</button>)}</div>}
      <form className="coach-input" onSubmit={submit}><label htmlFor="coach-question" className="sr-only">AI koça sor</label><textarea ref={inputRef} id="coach-question" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(input); } }} placeholder="Programınla ilgili bir şey sor…" maxLength={600} rows={2} /><button type={busy ? "button" : "submit"} aria-label={busy ? "Yanıtı durdur" : "Soruyu gönder"} onClick={busy ? stop : undefined}>{busy ? "■" : "↑"}</button></form>
      <p className="coach-disclaimer">Tıbbi tanı yerine geçmez. Ağrı veya yaralanmada sağlık uzmanına danış.</p>
    </aside>}
  </>;
}
