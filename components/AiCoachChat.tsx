"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { localCoachReply, type CoachMessage } from "@/lib/ai-coach";
import { authorizedFetch } from "@/lib/api-client";
import { useTranslations } from "@/lib/i18n/translate";
import { useLocale } from "@/lib/i18n/locale";

export function AiCoachChat({ context }: { context: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const suggestions = [t.aiCoachChat.suggestion1, t.aiCoachChat.suggestion2, t.aiCoachChat.suggestion3];
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Array<CoachMessage & { id: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);
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
      const response = await authorizedFetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context, messages: conversation.map(({ role, text: messageText }) => ({ role, text: messageText })), locale }), signal: controller.signal });
      const result = await response.json().catch(() => ({})) as { text?: string; error?: string; notice?: string; usage?: { used: number; limit: number } };
      if ([401, 403, 503].includes(response.status)) {
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: localCoachReply(value, locale) }]);
        setNotice(t.aiCoachChat.localSessionFallback);
        return;
      }
      if (!response.ok || !result.text) throw new Error(result.error || t.aiCoachChat.coachUnresponsive);
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: result.text as string }]);
      setNotice(result.notice || "");
      if (result.usage) setUsage(result.usage);
    } catch (requestError) {
      if ((requestError as Error).name !== "AbortError") setError(requestError instanceof Error ? requestError.message : t.aiCoachChat.coachUnreachable);
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
    <button ref={launcherRef} type="button" className={`coach-launcher ${open ? "active" : ""}`} aria-label={open ? t.aiCoachChat.closeCoach : t.aiCoachChat.openCoach} aria-expanded={open} aria-controls="ai-coach-panel" onClick={() => setOpen((current) => !current)}><span aria-hidden="true">✦</span><strong>{t.aiCoachChat.launcherLabel}</strong></button>
    {open && <aside id="ai-coach-panel" className="coach-chat" role="dialog" aria-modal="false" aria-labelledby="ai-coach-title">
      <header><div><span className="coach-online" aria-hidden="true" /><div><strong id="ai-coach-title">{t.aiCoachChat.title}</strong><small>{t.aiCoachChat.subtitle}</small></div></div><button type="button" aria-label={t.aiCoachChat.closeCoach} onClick={closeCoach}>×</button></header>
      <Conversation className="coach-conversation"><ConversationContent className="coach-messages">
        {messages.length === 0 ? <ConversationEmptyState title={t.aiCoachChat.emptyTitle} description={t.aiCoachChat.emptyDescription} icon={<span className="coach-empty-icon">✦</span>} /> : messages.map((message) => <Message from={message.role} key={message.id}><MessageContent><MessageResponse>{message.text}</MessageResponse></MessageContent></Message>)}
        {busy && <div className="coach-thinking" role="status"><i /><i /><i /><span>{t.aiCoachChat.thinking}</span></div>}
        {error && <div className="coach-error" role="alert">{error} {t.aiCoachChat.tryAgain}</div>}
        {notice && <div className="coach-notice" role="status">{notice}</div>}
        {usage && <div className="coach-usage" role="status">{t.aiCoachChat.dailyUsage(usage.used, usage.limit)}</div>}
      </ConversationContent><ConversationScrollButton aria-label={t.aiCoachChat.goToLastMessage} /></Conversation>
      {messages.length === 0 && <div className="coach-suggestions">{suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => void send(suggestion)}>{suggestion}</button>)}</div>}
      <form className="coach-input" onSubmit={submit}><label htmlFor="coach-question" className="sr-only">{t.aiCoachChat.inputLabel}</label><textarea ref={inputRef} id="coach-question" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(input); } }} placeholder={t.aiCoachChat.inputPlaceholder} maxLength={600} rows={2} /><button type={busy ? "button" : "submit"} aria-label={busy ? t.aiCoachChat.stopResponse : t.aiCoachChat.sendQuestion} onClick={busy ? stop : undefined}>{busy ? "■" : "↑"}</button></form>
      <p className="coach-disclaimer">{t.aiCoachChat.disclaimer}</p>
    </aside>}
  </>;
}
