// Receipt changes and paging never move the incoming-message baseline backwards.
export function advanceIncomingCursor(previous, candidate) {
  const next=Number.isSafeInteger(candidate)&&candidate>=0?candidate:0;
  const initial=previous===null;
  return {cursor:initial?next:Math.max(previous,next),hasNew:!initial&&next>previous};
}
