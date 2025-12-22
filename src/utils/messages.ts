/**
 * Funny and quirky messages used throughout the app
 * Each message is kept short to fit in 2 lines on mobile
 */

type MessageScenario = 'game_paused' | 'waiting_to_start';

const MESSAGES: Record<MessageScenario, string[]> = {
  game_paused: [
    "Host is up to something...",
    "Plotting twist detected!",
    "Host pressed the pause button!",
    "Time freeze activated!",
    "Host needs a coffee break ☕",
    "Timeout! But not for you.",
    "Host is rethinking life choices",
    "Pause button: engaged!",
    "Host is buying time... literally",
    "Suspense mode: ON",
    "Host went AFK. Brb!",
    "Taking a tactical timeout",
  ],
  waiting_to_start: [
    "Waiting for host to start...",
    "Host is preparing something epic!",
    "Almost time to shine!",
    "Get ready to rumble!",
    "Warming up the game engine...",
    "Host is setting the stage!",
    "The fun is about to begin!",
    "Buckle up! Starting soon...",
    "Host is brewing the questions ☕",
    "Patience, young padawan...",
    "Loading awesomeness...",
    "Host is in the zone!",
  ],
};

/**
 * Picks a random message for the given scenario
 * @param scenario - The scenario to pick a message for
 * @returns A random message string for the scenario
 */
export function getRandomMessage(scenario: MessageScenario): string {
  const messages = MESSAGES[scenario];
  if (!messages || messages.length === 0) {
    return "Hold tight!";
  }
  const randomIndex = Math.floor(Math.random() * messages.length);
  return messages[randomIndex];
}

/**
 * Export the MessageScenario type for use in other files
 */
export type { MessageScenario };
