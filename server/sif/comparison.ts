import type { ComparisonStatus } from "./contracts";

export function determineComparability(input: {
  leftDocumentDate?: Date | null;
  rightDocumentDate?: Date | null;
  leftFamily: string;
  rightFamily: string;
  leftTaxonomy?: string | null;
  rightTaxonomy?: string | null;
  leftHasValue: boolean;
  rightHasValue: boolean;
}): ComparisonStatus {
  if (!input.leftHasValue || !input.rightHasValue) return "Partially comparable";
  if (input.leftFamily !== input.rightFamily) return "Different source types";
  if (input.leftDocumentDate && input.rightDocumentDate && input.leftDocumentDate.getTime() !== input.rightDocumentDate.getTime()) {
    return "Different document periods";
  }
  if (input.leftTaxonomy && input.rightTaxonomy && input.leftTaxonomy !== input.rightTaxonomy) {
    return "Different provider taxonomies";
  }
  return "Comparable";
}
