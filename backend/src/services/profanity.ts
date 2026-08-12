// Basic profanity gate for task/Tribe names & descriptions - a static
// wordlist with whole-word matching, not a full content-moderation system.
// Good enough to stop casual bad language from a home-services listing
// without flagging legitimate text that happens to contain a word as a
// substring (e.g. "grass" shouldn't match "ass").
const BLOCKED_WORDS = [
  "fuck",
  "fucking",
  "fucker",
  "motherfucker",
  "shit",
  "bullshit",
  "bitch",
  "asshole",
  "ass",
  "cunt",
  "dick",
  "piss",
  "pissed",
  "whore",
  "slut",
  "bastard",
  "twat",
  "wanker",
  "prick",
  "cock",
  "nigger",
  "nigga",
  "faggot",
  "fag",
  "retard",
  "retarded",
  "spastic",
  "paki",
  "tranny",
  "rape",
  "rapist",
];

export function findProfanity(...texts: (string | null | undefined)[]): string[] {
  const combined = texts.filter((t): t is string => Boolean(t)).join(" \n ");
  const found = new Set<string>();
  for (const word of BLOCKED_WORDS) {
    const re = new RegExp(`\\b${word}\\b`, "i");
    if (re.test(combined)) found.add(word);
  }
  return [...found];
}
