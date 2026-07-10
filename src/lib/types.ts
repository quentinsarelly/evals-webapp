export interface Person {
  id: string;
  authUserId: string | null;
  fullName: string;
  email: string;
  managerId: string | null;
  team: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EligiblePair {
  id: string;
  evaluatorId: string;
  evaluateeId: string;
  isMandatory: boolean;
  createdAt: string;
}

export type CycleStatus =
  | "draft"
  | "assignments_generated"
  | "open"
  | "closed"
  | "exported";

export interface Cycle {
  id: string;
  name: string;
  slug: string;
  periodStart: string;
  periodEnd: string;
  minEvaluationsReceived: number;
  maxEvaluationsGiven: number;
  /**
   * Year-end cycles ("more extensive evaluation") turn this on to run the
   * optimizer pass for optional peer evaluations on top of mandatory
   * self+manager pairs. Mid-year cycles leave it off, since eligible_pairs
   * is a standing table (not scoped per cycle) and may still hold optional
   * pairs imported from matrix.csv for a prior year-end cycle.
   */
  includeOptionalPeers: boolean;
  status: CycleStatus;
  responseDeadline: string | null;
  createdAt: string;
}

export type AssignmentSource = "generated" | "mandatory" | "manual";
export type AssignmentStatus = "pending" | "in_progress" | "submitted";

export interface Assignment {
  id: string;
  cycleId: string;
  evaluatorId: string;
  evaluateeId: string;
  isSelfEval: boolean;
  isMandatory: boolean;
  source: AssignmentSource;
  status: AssignmentStatus;
  submittedAt: string | null;
  createdAt: string;
  // joined convenience fields, populated by services when needed
  evaluatorName?: string;
  evaluateeName?: string;
}

export interface Category {
  id: string;
  key: string;
  labelEs: string;
  displayOrder: number;
  hasRating: boolean;
  hasWinsAreas: boolean;
  maxWins: number;
  maxAreas: number;
}

export interface EvaluationResponse {
  id: string;
  assignmentId: string;
  categoryId: string;
  rating: number | null;
  wins: string[];
  areasOfOpportunity: string[];
  createdAt: string;
  updatedAt: string;
}

export interface EvaluationExtras {
  assignmentId: string;
  growthPlan: string | null;
  otherComments: string | null;
  isDraft: boolean;
  updatedAt: string;
}

export interface CycleCompletionRow {
  personId: string;
  fullName: string;
  assignmentsGiven: number;
  assignmentsGivenSubmitted: number;
  assignmentsReceived: number;
  assignmentsReceivedSubmitted: number;
}
