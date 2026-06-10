export type PlaygroundSkillId = 'image' | 'video'

export interface PlaygroundSkill {
  id: PlaygroundSkillId
  label: string
  shortLabel: string
  model: string
  endpoint: string
  description: string
  keywords: string[]
  promptHint: string
}

export interface DetectedPlaygroundSkill extends PlaygroundSkill {
  matchedKeywords: string[]
  confidence: 'medium' | 'high'
}

const creationVerbs = [
  'create',
  'generate',
  'make',
  'render',
  'design',
  'draw',
  'illustrate',
  'produce',
  'turn into',
  'text to',
  'text-to',
]

export const playgroundSkills: PlaygroundSkill[] = [
  {
    id: 'image',
    label: 'Image generation',
    shortLabel: 'Image',
    model: 'flux',
    endpoint: 'https://gen.pollinations.ai/image',
    description: 'Routes visual creation prompts to an image model and previews the generated asset.',
    keywords: [
      'image',
      'picture',
      'photo',
      'illustration',
      'poster',
      'logo',
      'banner',
      'thumbnail',
      'mockup',
      'sticker',
      'icon',
      'wallpaper',
      'concept art',
      'text-to-image',
    ],
    promptHint: 'Generate an image of a clean app dashboard floating above a city at sunrise',
  },
  {
    id: 'video',
    label: 'Video generation',
    shortLabel: 'Video',
    model: 'seedance-2.0',
    endpoint: 'https://gen.pollinations.ai/video',
    description: 'Routes motion prompts to a video model and returns a playable generation URL.',
    keywords: [
      'video',
      'clip',
      'animation',
      'animate',
      'trailer',
      'b-roll',
      'timelapse',
      'motion',
      'scene',
      'cinematic',
      'reel',
      'text-to-video',
    ],
    promptHint: 'Create a 5 second cinematic product video of a glass AI device on a desk',
  },
]

const analysisPhrases = [
  'describe this image',
  'analyze this image',
  'what is in this image',
  'what do you see',
  'caption this image',
]

function includesAny(text: string, terms: string[]) {
  return terms.filter(term => text.includes(term))
}

export function detectPlaygroundSkills(prompt: string): DetectedPlaygroundSkill[] {
  const normalized = prompt.toLowerCase().replace(/\s+/g, ' ').trim()
  if (!normalized || analysisPhrases.some(phrase => normalized.includes(phrase))) return []

  const verbMatches = includesAny(normalized, creationVerbs)

  return playgroundSkills
    .map(skill => {
      const keywordMatches = includesAny(normalized, skill.keywords)
      const explicitModality = normalized.includes(`/${skill.id}`) || normalized.includes(`:${skill.id}`)
      const matchedKeywords = Array.from(new Set([...keywordMatches, ...verbMatches]))

      if (keywordMatches.length === 0 && !explicitModality) return null
      if (verbMatches.length === 0 && !explicitModality && !keywordMatches.some(k => k.includes('text-to'))) return null

      return {
        ...skill,
        matchedKeywords,
        confidence: verbMatches.length > 0 || explicitModality ? 'high' : 'medium',
      } satisfies DetectedPlaygroundSkill
    })
    .filter((skill): skill is DetectedPlaygroundSkill => Boolean(skill))
}

export function buildGenerationUrl(skill: PlaygroundSkill, prompt: string) {
  const url = new URL(`${skill.endpoint}/${encodeURIComponent(prompt)}`)
  url.searchParams.set('model', skill.model)
  if (skill.id === 'image') {
    url.searchParams.set('width', '1024')
    url.searchParams.set('height', '1024')
    url.searchParams.set('enhance', 'true')
  }
  return url.toString()
}
