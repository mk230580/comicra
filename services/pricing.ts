// All prices are in USD per million tokens, unless otherwise specified.
// Based on public pricing as of latest update.
const USD_PER_MILLION_TOKENS = {
    'gemini-2.5-flash': {
        prompt: 0.35,
        completion: 0.70,
    }
};

export const PRICING = {
    // Price per image for Imagen model
    IMAGEN_PER_IMAGE: 0.02,
    // Veo pricing is often per second. Example price, might need adjustment.
    VEO_PER_SECOND: 0.01
};

export function calculateTextCost(promptTokens: number, completionTokens: number, model: keyof typeof USD_PER_MILLION_TOKENS = 'gemini-2.5-flash'): number {
    const pricing = USD_PER_MILLION_TOKENS[model];
    if (!pricing) return 0;

    const promptCost = (promptTokens / 1_000_000) * pricing.prompt;
    const completionCost = (completionTokens / 1_000_000) * pricing.completion;

    return promptCost + completionCost;
}
