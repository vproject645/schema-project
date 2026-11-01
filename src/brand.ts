/**
 * Presentation-layer wording. Server records and error messages may still name
 * the model provider; the interface refers to it neutrally as Schema's AI service.
 * This only rewrites display text and never touches stored data.
 */
export function neutral(text: string): string {
  return text
    .replace(/\bMuse Spark(?: [\d.]+)?/g, 'Schema AI')
    .replace(/\bMeta Model\b/g, 'Model')
    .replace(/\bMeta (request|review|file|upload|key|connection|credential|extraction|response|proposal|model)\b/g, 'AI $1')
    .replace(/\bMeta(?:’s|'s)\b/g, 'the AI service’s')
    .replace(/(^|[.!?]\s+)Meta\b/g, '$1The AI service')
    .replace(/\bMeta\b/g, 'the AI service');
}
