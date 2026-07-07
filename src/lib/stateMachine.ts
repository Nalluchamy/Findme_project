import { ParcelState, LedgerEventType } from '@prisma/client';

// Strict state transition map
export const STATE_TRANSITIONS: Record<ParcelState, ParcelState[]> = {
  CREATED: ['COD_COLLECTED', 'DISCREPANCY_FLAGGED'],
  COD_COLLECTED: ['HANDOVER_TO_DEST_HUB', 'DISCREPANCY_FLAGGED'],
  HANDOVER_TO_DEST_HUB: ['HANDOVER_TO_ORIGIN_HUB', 'DISCREPANCY_FLAGGED'],
  HANDOVER_TO_ORIGIN_HUB: ['HANDOVER_TO_ORIGIN_BRANCH', 'DISCREPANCY_FLAGGED'],
  HANDOVER_TO_ORIGIN_BRANCH: ['SETTLED_TO_SELLER', 'DISCREPANCY_FLAGGED'],
  SETTLED_TO_SELLER: [], // End of state (terminal)
  DISCREPANCY_FLAGGED: ['COD_COLLECTED', 'HANDOVER_TO_DEST_HUB', 'HANDOVER_TO_ORIGIN_HUB', 'HANDOVER_TO_ORIGIN_BRANCH', 'SETTLED_TO_SELLER'], // Can resume after resolution
};

// Event type to next state mapping
export const EVENT_TO_STATE: Record<LedgerEventType, ParcelState> = {
  COD_COLLECTED: 'COD_COLLECTED',
  HANDOVER_TO_DEST_HUB: 'HANDOVER_TO_DEST_HUB',
  HANDOVER_TO_ORIGIN_HUB: 'HANDOVER_TO_ORIGIN_HUB',
  HANDOVER_TO_ORIGIN_BRANCH: 'HANDOVER_TO_ORIGIN_BRANCH',
  SETTLED_TO_SELLER: 'SETTLED_TO_SELLER',
  DISCREPANCY_FLAGGED: 'DISCREPANCY_FLAGGED',
};

/**
 * Validates whether the state transition from current state to new state via event type is allowed.
 * Returns true if valid, or an error message if invalid.
 */
export function validateStateTransition(
  currentState: ParcelState,
  newEventType: LedgerEventType
): { valid: boolean; error?: string } {
  const targetState = EVENT_TO_STATE[newEventType];
  if (!targetState) {
    return { valid: false, error: `Invalid event type: ${newEventType}` };
  }

  // Check if transition is allowed
  const allowedNextStates = STATE_TRANSITIONS[currentState];
  if (!allowedNextStates || !allowedNextStates.includes(targetState)) {
    return {
      valid: false,
      error: `Invalid transition: cannot move from current state '${currentState}' to target state '${targetState}' via event '${newEventType}'.`,
    };
  }

  return { valid: true };
}
