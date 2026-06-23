/**
 * Shared utility for determining whether a model is free or premium.
 */
export function isFreeModel(platform: string, modelId: string): boolean {
  return ['kilo', 'pollinations', 'llm7'].includes(platform)
    || modelId.endsWith('-free')
    || modelId.includes(':free');
}
