export const EncounterPhase = Object.freeze({
  PLANNING: 'planning',
  RESOLVING: 'resolving',
  COMPLETE: 'complete',
});

/**
 * Applies a committed player action to the encounter state.
 * The returned state is a new snapshot for presentation.
 */
export function resolveAction(state, action) {
  if (state.phase !== EncounterPhase.PLANNING) {
    throw new Error(`Cannot act during ${state.phase}`);
  }

  const target = state.actors.find(actor => actor.id === action.targetId);
  if (!target) throw new Error(`Unknown target: ${action.targetId}`);

  const actors = state.actors.map(actor => actor.id === target.id
    ? { ...actor, health: Math.max(0, actor.health - action.damage) }
    : actor);

  return {
    ...state,
    phase: actors.some(actor => actor.hostile && actor.health > 0)
      ? EncounterPhase.PLANNING
      : EncounterPhase.COMPLETE,
    actors,
  };
}
