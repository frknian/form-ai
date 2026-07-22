"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import type { CoachMessage } from "@/lib/ai-coach";

const suggestions = ["Bugünkü programımı özetle", "Bu hareketi nasıl kolaylaştırırım?", "Dinlenme sürem uygun mu?"];

export function AiCoachChat({ context }: { context: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Array<CoachMessage & { id: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const requestController = useRef<AbortController | null>(null);

  function closeCoach() {
    setOpen(false);
    window.requestAnimationFrame(() => launcherRef.current?.focus());
  }

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCoach();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => () => requestController.current?.abort(), []);

  async function send(text: string) {
    const value = text.trim().slice(0, 600);
    if (!value || busy) return;
    const userMessage = { id: crypto.randomUUID(), role: "user" as const, text: value };
    const conversation = [...messages, userMessage].slice(-12);
    setMessages(conversation);
    setInput("");
    setBusy(true);
    setError("");
    setNotice("");
    const controller = new AbortController();
    requestController.current = controller;
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context, messages: conversation.map(({ role, text: messageText }) => ({ role, text: messageText })) }), signal: controller.signal });
      const result = await response.json().catch(() => ({})) as { text?: string; error?: string; notice?: string };
      if (!response.ok || !result.text) throw new Error(result.error || "AI koç yanıt veremedi.");
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: result.text as string }]);
      setNotice(result.notice || "");
    } catch (requestError) {
      if ((requestError as Error).name !== "AbortError") setError(requestError instanceof Error ? requestError.message : "AI koça ulaşılamıyor.");
    } finally {
      if (requestController.current === controller) requestController.current = null;
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(input);
  }

  function stop() {
    requestController.current?.abort();
    requestController.current = null;
    setBusy(false);
  }

  return <>
    <button ref={launcherRef} type="button" className={`coach-launcher ${open ? "active" : ""}`} aria-label={open ? "AI koçu kapat" : "AI koça sor"} aria-expanded={open} aria-controls="ai-coach-panel" onClick={() => setOpen((current) => !current)}><span aria-hidden="true">✦</span><strong>AI Koç</strong></button>
    {open && <aside id="ai-coach-panel" className="coach-chat" role="dialog" aria-modal="false" aria-labelledby="ai-coach-title">
      <header><div><span className="coach-online" aria-hidden="true" /><div><strong id="ai-coach-title">FİT.AI koç</strong><small>Programını bilen asistan</small></div></div><button type="button" aria-label="AI koçu kapat" onClick={closeCoach}>×</button></header>
      <Conversation className="coach-conversation"><ConversationContent className="coach-messages">
        {messages.length === 0 ? <ConversationEmptyState title="Sana nasıl yardımcı olayım?" description="Programın, ekipmanların ve ilerlemen hakkında sorabilirsin." icon={<span className="coach-empty-icon">✦</span>} /> : messages.map((message) => <Message from={message.role} key={message.id}><MessageContent><MessageResponse>{message.text}</MessageResponse></MessageContent></Message>)}
        {busy && <div className="coach-thinking" role="status"><i /><i /><i /><span>Koç düşünüyor</span></div>}
        {error && <div className="coach-error" role="alert">{error} Yeniden deneyebilirsin.</div>}
        {notice && <div className="coach-notice" role="status">{notice}</div>}
      </ConversationContent><ConversationScrollButton aria-label="Son mesaja git" /></Conversation>
      {messages.length === 0 && <div className="coach-suggestions">{suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => void send(suggestion)}>{suggestion}</button>)}</div>}
      <form className="coach-input" onSubmit={submit}><label htmlFor="coach-question" className="sr-only">AI koça sor</label><textarea ref={inputRef} id="coach-question" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(input); } }} placeholder="Programınla ilgili bir şey sor…" maxLength={600} rows={2} /><button type={busy ? "button" : "submit"} aria-label={busy ? "Yanıtı durdur" : "Soruyu gönder"} onClick={busy ? stop : undefined}>{busy ? "■" : "↑"}</button></form>
      <p className="coach-disclaimer">Tıbbi tanı yerine geçmez. Ağrı veya yaralanmada sağlık uzmanına danış.</p>
    </aside>}
  </>;
}
