import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { determineComparability } from "../sif/comparison";
import { evidencePageLink } from "../sif/evidence";
import {
  discoverOfficialDocuments,
  ingestOfficialCandidate,
  ingestOfficialDirectUrl,
  ingestUserSuppliedPdf,
} from "../sif/ingestion";
import {
  getDocumentFactsForChat,
  getDocumentReader,
  listSifWorkspace,
  recordSifChatTurn,
} from "../sif/repository";
import { protectedProcedure, router } from "../_core/trpc";

const readerInput = z.object({ documentId: z.number().int().positive() });

function factLabel(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function exactReaderOrThrow(reader: Awaited<ReturnType<typeof getDocumentReader>>) {
  if (!reader) throw new TRPCError({ code: "NOT_FOUND", message: "The selected immutable document was not found." });
  return reader;
}

export const sifRouter = router({
  workspace: protectedProcedure.query(async () => listSifWorkspace()),

  discover: protectedProcedure.input(z.object({
    sourceId: z.number().int().positive(),
    requestedPeriod: z.string().max(48).optional(),
  })).query(async ({ input }) => discoverOfficialDocuments(input.sourceId, input.requestedPeriod)),

  ingestOfficialCandidate: protectedProcedure.input(z.object({
    sourceId: z.number().int().positive(),
    candidateUrl: z.string().url().max(2048),
  })).mutation(async ({ input }) => ingestOfficialCandidate(input.sourceId, input.candidateUrl)),

  ingestDirectPdf: protectedProcedure.input(z.object({
    sourceId: z.number().int().positive(),
    url: z.string().url().max(2048),
  })).mutation(async ({ input }) => ingestOfficialDirectUrl(input.sourceId, input.url)),

  uploadPdf: protectedProcedure.input(z.object({
    sourceId: z.number().int().positive(),
    fileName: z.string().min(1).max(512),
    base64: z.string().min(8).max(34_000_000),
  })).mutation(async ({ input, ctx }) => {
    const rawBase64 = input.base64.includes(",") ? input.base64.split(",", 2)[1] : input.base64;
    const bytes = Buffer.from(rawBase64, "base64");
    if (bytes.byteLength === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "The uploaded PDF was empty." });
    return ingestUserSuppliedPdf({ sourceId: input.sourceId, bytes, originalFileName: input.fileName, uploaderId: ctx.user.id });
  }),

  reader: protectedProcedure.input(readerInput).query(async ({ input }) => {
    const reader = exactReaderOrThrow(await getDocumentReader(input.documentId));
    const stableFileUrl = reader.document.document.stableFileUrl;
    return {
      ...reader,
      sections: reader.sections.map((section) => ({
        ...section,
        facts: section.facts.map((fact) => ({
          ...fact,
          evidence: fact.evidence.map((evidence) => ({
            ...evidence,
            pageUrl: evidencePageLink(stableFileUrl, evidence.pageNumber),
          })),
        })),
      })),
    };
  }),

  compareFact: protectedProcedure.input(z.object({
    leftDocumentId: z.number().int().positive(),
    rightDocumentId: z.number().int().positive(),
    factKey: z.string().min(1).max(128),
    leftSectionId: z.number().int().positive().optional(),
    rightSectionId: z.number().int().positive().optional(),
  })).query(async ({ input }) => {
    const [left, right] = await Promise.all([
      getDocumentReader(input.leftDocumentId),
      getDocumentReader(input.rightDocumentId),
    ]);
    const leftReader = exactReaderOrThrow(left);
    const rightReader = exactReaderOrThrow(right);
    const leftSections = input.leftSectionId ? leftReader.sections.filter((section) => section.id === input.leftSectionId) : leftReader.sections;
    const rightSections = input.rightSectionId ? rightReader.sections.filter((section) => section.id === input.rightSectionId) : rightReader.sections;
    const leftFact = leftSections.flatMap((section) => section.facts).find((fact) => fact.factKey === input.factKey);
    const rightFact = rightSections.flatMap((section) => section.facts).find((fact) => fact.factKey === input.factKey);
    const status = determineComparability({
      leftDocumentDate: leftReader.document.document.documentDate,
      rightDocumentDate: rightReader.document.document.documentDate,
      leftFamily: leftReader.document.document.documentFamily,
      rightFamily: rightReader.document.document.documentFamily,
      leftTaxonomy: leftFact?.qualifier,
      rightTaxonomy: rightFact?.qualifier,
      leftHasValue: Boolean(leftFact?.valueText),
      rightHasValue: Boolean(rightFact?.valueText),
    });

    return {
      factKey: input.factKey,
      status,
      left: leftFact ? {
        valueText: leftFact.valueText,
        qualifier: leftFact.qualifier,
        sourceFamily: leftReader.document.document.documentFamily,
        documentDate: leftReader.document.document.documentDate,
        evidence: leftFact.evidence.map((item) => ({ ...item, pageUrl: evidencePageLink(leftReader.document.document.stableFileUrl, item.pageNumber) })),
      } : null,
      right: rightFact ? {
        valueText: rightFact.valueText,
        qualifier: rightFact.qualifier,
        sourceFamily: rightReader.document.document.documentFamily,
        documentDate: rightReader.document.document.documentDate,
        evidence: rightFact.evidence.map((item) => ({ ...item, pageUrl: evidencePageLink(rightReader.document.document.stableFileUrl, item.pageNumber) })),
      } : null,
    };
  }),

  chat: protectedProcedure.input(z.object({
    documentId: z.number().int().positive(),
    sectionId: z.number().int().positive().optional(),
    question: z.string().min(2).max(1000),
  })).mutation(async ({ input, ctx }) => {
    const scoped = await getDocumentFactsForChat(input.documentId, input.sectionId);
    if (!scoped) throw new TRPCError({ code: "NOT_FOUND", message: "The selected immutable document was not found." });
    const flatFacts = scoped.sections.flatMap((section) => section.facts);
    const terms = input.question.toLowerCase().match(/[a-z]{4,}/g) ?? [];
    const summaryRequest = /\b(summary|summarise|summarize|overview|tell me about)\b/i.test(input.question);
    const matches = (summaryRequest ? flatFacts : flatFacts.filter((fact) => {
      const corpus = `${fact.factKey} ${fact.qualifier ?? ""} ${fact.valueText ?? ""}`.toLowerCase();
      return terms.some((term) => corpus.includes(term));
    })).slice(0, 5);

    if (matches.length === 0) {
      const answer = "This document does not clearly disclose the requested information in the selected evidence scope.";
      await recordSifChatTurn({
        userId: ctx.user.id,
        question: input.question,
        answer,
        documentIds: [input.documentId],
        sectionIds: input.sectionId ? [input.sectionId] : [],
        evidenceIds: [],
      });
      return { answer, citations: [] as Array<{ evidenceId: number; pageNumber: number; quote: string; pageUrl?: string }> };
    }

    const lines = matches.map((fact) => `${factLabel(fact.factKey)}${fact.qualifier ? ` — ${fact.qualifier}` : ""}: ${fact.valueText}.`);
    const answer = `Based only on the selected document: ${lines.join(" ")}`;
    const citations = matches.flatMap((fact) => fact.evidence.map((evidence) => ({
      evidenceId: evidence.id,
      pageNumber: evidence.pageNumber,
      quote: evidence.quote,
      pageUrl: evidencePageLink(scoped.document.document.stableFileUrl, evidence.pageNumber),
    })));
    await recordSifChatTurn({
      userId: ctx.user.id,
      question: input.question,
      answer,
      documentIds: [input.documentId],
      sectionIds: scoped.sections.map((section) => section.id),
      evidenceIds: citations.map((citation) => citation.evidenceId),
    });
    return { answer, citations };
  }),
});
