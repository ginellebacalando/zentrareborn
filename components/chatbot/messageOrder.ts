let last = 0;

/**
 * Arrival order for everything shown in the Zeni window. Zeni's replies and the staff chat come from
 * different requests, so each message is numbered when it reaches the browser and the window shows
 * one timeline in that order (after a chat returns to Zeni, new answers appear below it).
 */
export function nextMessageOrder() {
  last += 1;
  return last;
}
