export function messagePlainText(message: { data: { parts?: readonly unknown[] | null } }): string {
  const parts = message.data.parts ?? []
  return parts
    .flatMap((part) => {
      if (typeof part !== 'object' || part === null || !('type' in part) || !('text' in part)) return []
      const record = part as { type?: unknown; text?: unknown }
      return record.type === 'text' && typeof record.text === 'string' && record.text ? [record.text] : []
    })
    .join('\n')
    .trim()
}
