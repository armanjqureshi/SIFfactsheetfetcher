import { FormEvent, useState } from "react";
import { MessageCircle, Send, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { EvidenceButton } from "./EvidenceButton";

type ChatPanelProps = {
  documentId: number;
  sectionId?: number;
  strategyName?: string | null;
};

export function ChatPanel({ documentId, sectionId, strategyName }: ChatPanelProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string>();
  const [citations, setCitations] = useState<Array<{ evidenceId: number; pageNumber: number; quote: string; pageUrl?: string }>>([]);
  const chat = trpc.sif.chat.useMutation({
    onSuccess: (result) => {
      setAnswer(result.answer);
      setCitations(result.citations);
    },
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || chat.isPending) return;
    await chat.mutateAsync({ documentId, sectionId, question: trimmed });
  }

  return (
    <aside className="chat-panel" aria-label="Document-grounded chat">
      <div className="chat-heading"><span className="utility-icon"><MessageCircle size={16} /></span><div><strong>Ask this document</strong><small>{strategyName ? `Scoped to ${strategyName}` : "Scoped to the selected PDF"}</small></div></div>
      <p className="chat-policy"><Sparkles size={14} /> Answers are assembled only from extracted, page-cited evidence.</p>
      {answer && <div className="chat-answer"><p>{answer}</p>{citations.length > 0 && <div className="chat-citations">{citations.map((citation) => <EvidenceButton key={citation.evidenceId} pageUrl={citation.pageUrl} pageNumber={citation.pageNumber} compact />)}</div>}</div>}
      {chat.error && <p className="inline-error">{chat.error.message}</p>}
      <form onSubmit={submit} className="chat-form">
        <label htmlFor="document-question">Question</label>
        <textarea id="document-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="For example: What benchmark is disclosed?" rows={3} />
        <button type="submit" className="primary-button" disabled={chat.isPending || question.trim().length < 2}>{chat.isPending ? "Checking evidence…" : <><Send size={15} /> Ask with evidence</>}</button>
      </form>
    </aside>
  );
}
