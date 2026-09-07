// Generates friendly, URL-friendly profile names like "cosmic-falcon".

const ADJECTIVES = [
  'cosmic', 'swift', 'lunar', 'solar', 'crimson', 'azure', 'golden', 'silent',
  'brave', 'clever', 'gentle', 'rapid', 'quantum', 'stellar', 'amber', 'iron',
  'jade', 'nimble', 'polar', 'royal', 'shadow', 'vivid', 'wild', 'zen',
]

const ANIMALS = [
  'falcon', 'otter', 'tiger', 'lynx', 'heron', 'panda', 'koala', 'raven',
  'wolf', 'fox', 'orca', 'eagle', 'bison', 'gecko', 'moth', 'puma',
  'hawk', 'crane', 'ibex', 'marlin', 'newt', 'quokka', 'seal', 'yak',
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** e.g. "cosmic-falcon". */
export function generateCodename(): string {
  return `${pick(ADJECTIVES)}-${pick(ANIMALS)}`
}
