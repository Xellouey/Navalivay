export interface GroupReviewTreeNode {
  id: string;
  children?: GroupReviewTreeNode[];
}

/** Parent brand/container row in the category tree. */
export function isParentGroupLine(node: GroupReviewTreeNode): boolean {
  return (node.children?.length ?? 0) > 0;
}

/**
 * Reviews are submitted per purchased line (leaf group_id in order detail).
 * Parent containers are browse-only on the storefront.
 */
export function isReviewSubmissionGroup(node: GroupReviewTreeNode): boolean {
  return !isParentGroupLine(node);
}

/**
 * Show review summary on both parent and leaf rows:
 * parents usually have zero direct reviews but signal that the brand row itself
 * has no published feedback yet; leaves show the actual line rating.
 */
export function shouldShowGroupReviewSummary(_node: GroupReviewTreeNode): boolean {
  return true;
}