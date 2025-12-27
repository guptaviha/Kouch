/**
 * Funny and quirky messages used throughout the app
 * Each message is kept short to fit in 2 lines on mobile
 */

type MessageScenario = 'game_paused' | 'waiting_to_start' | 'answer_received' | 'waiting_for_players';

const MESSAGES: Record<MessageScenario, string[]> = {
  game_paused: [
    "Host is up to something",
    "Plotting twist detected",
    "Host pressed the pause button",
    "Time freeze activated",
    "Host needs a coffee break ☕",
    "Timeout — but not for you",
    "Host is rethinking life choices",
    "Pause button engaged",
    "Host is buying time literally",
    "Suspense mode ON",
    "Host went AFK — brb",
    "Taking a tactical timeout",
  ],
  waiting_to_start: [
    "Host is preparing something epic",
    "Almost time to shine",
    "Get ready to rumble",
    "Warming up the game engine",
    "Host is setting the stage",
    "The fun is about to begin",
    "Buckle up — starting soon",
    "Host is brewing the questions ☕",
    "Patience, young padawan",
    "Loading awesomeness",
    "Host is in the zone",
    "Standby for awesomeness",
    "Get your thinking caps on"
  ],
  answer_received: [
    "Got it!",
    "Answer received!",
    "Locked and loaded!",
    "Your answer is in!",
    "Fingers crossed.",
    "Boom! Answer sent.",
    "Answer on its way!",
    "Sent with style!"
  ],
  waiting_for_players: [
    "Waiting for others to catch up",
    "Hold tight",
    "Others are still thinking",
    "Patience is a virtue",
    "Waiting for the rest",
    "Just waiting on a few more",
    "Slowpokes still working",
    "The gang's not all here yet",
  ]
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
