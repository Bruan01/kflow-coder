const ESCAPE = String.fromCharCode(27);

function isControlCharacter(character: string): boolean {
  const code = character.charCodeAt(0);
  return (
    code <= 8 || (code >= 11 && code <= 31) || (code >= 127 && code <= 159)
  );
}

export function sanitizeTerminalText(text: string): string {
  let output = "";
  let index = 0;
  while (index < text.length) {
    const character = text[index] ?? "";
    if (character === ESCAPE && text[index + 1] === "[") {
      index += 2;
      while (index < text.length) {
        const code = text.charCodeAt(index);
        index += 1;
        if (code >= 64 && code <= 126) break;
      }
      continue;
    }
    if (!isControlCharacter(character)) output += character;
    index += 1;
  }
  return output;
}
