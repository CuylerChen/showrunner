declare module 'kokoro-js' {
  export const KokoroTTS: {
    from_pretrained(model: string, options?: Record<string, unknown>): Promise<{
      generate(text: string, options?: Record<string, unknown>): Promise<{
        save(outputPath: string): Promise<void>
      }>
    }>
  }
}
