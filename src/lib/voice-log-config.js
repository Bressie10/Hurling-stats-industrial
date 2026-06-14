export const ACTION_THRESHOLD = 0.6
export const PLAYER_THRESHOLD = 0.65
export const LOW_CONFIDENCE_THRESHOLD = 0.75

export const VOICE_ACTIONS = {
  point: {
    stat: 'Point',
    variants: ['point', 'points', 'score', "that's a point", 'good score', 'over the bar'],
  },
  goal: {
    stat: 'Goal',
    variants: ['goal', 'goals', "that's a goal"],
  },
  wide: {
    stat: 'Wide',
    variants: ['wide', 'wides', 'wide ball', "and it's wide", 'well off target'],
  },
  free: {
    stat: 'Free Won',
    variants: ['free', 'free taken', 'free point'],
  },
  45: {
    stat: '45',
    variants: ['45', 'forty five', 'forty-five'],
  },
  sideline: {
    stat: 'Sideline',
    variants: ['sideline', 'sideline ball', 'sideline cut'],
  },
  turnover: {
    stat: 'Turnover Lost',
    variants: ['turnover', 'lost ball', 'dispossessed'],
  },
  yellow: {
    stat: 'Yellow Card',
    variants: ['yellow', 'yellow card', 'booking'],
  },
  black: {
    stat: 'Black Card',
    variants: ['black', 'black card'],
  },
}

export function voiceActionVocabulary() {
  return Object.values(VOICE_ACTIONS).flatMap((action) => action.variants)
}
