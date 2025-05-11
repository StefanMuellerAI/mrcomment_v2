export const boldMap: { [key: string]: string } = {
  'A': '𝐀', 'B': '𝐁', 'C': '𝐂', 'D': '𝐃', 'E': '𝐄', 'F': '𝐅', 'G': '𝐆', 'H': '𝐇', 'I': '𝐈', 'J': '𝐉', 'K': '𝐊', 'L': '𝐋', 'M': '𝐌',
  'N': '𝐍', 'O': '𝐎', 'P': '𝐏', 'Q': '𝐐', 'R': '𝐑', 'S': '𝐒', 'T': '𝐓', 'U': '𝐔', 'V': '𝐕', 'W': '𝐖', 'X': '𝐗', 'Y': '𝐘', 'Z': '𝐙',
  'a': '𝐚', 'b': '𝐛', 'c': '𝐜', 'd': '𝐝', 'e': '𝐞', 'f': '𝐟', 'g': '𝐠', 'h': '𝐡', 'i': '𝐢', 'j': '𝐣', 'k': '𝐤', 'l': '𝐥', 'm': '𝐦',
  'n': '𝐧', 'o': '𝐨', 'p': '𝐩', 'q': '𝐪', 'r': '𝐫', 's': '𝐬', 't': '𝐭', 'u': '𝐮', 'v': '𝐯', 'w': '𝐰', 'x': '𝐱', 'y': '𝐲', 'z': '𝐳',
  '0': '𝟎', '1': '𝟏', '2': '𝟐', '3': '𝟑', '4': '𝟒', '5': '𝟓', '6': '𝟔', '7': '𝟕', '8': '𝟖', '9': '𝟗',
};

export const italicMap: { [key: string]: string } = {
  'A': '𝐴', 'B': '𝐵', 'C': '𝐶', 'D': '𝐷', 'E': '𝐸', 'F': '𝐹', 'G': '𝐺', 'H': '𝐻', 'I': '𝐼', 'J': '𝐽', 'K': '𝐾', 'L': '𝐿', 'M': '𝑀',
  'N': '𝑁', 'O': '𝑂', 'P': '𝑃', 'Q': '𝑄', 'R': '𝑅', 'S': '𝑆', 'T': '𝑇', 'U': '𝑈', 'V': '𝑉', 'W': '𝑊', 'X': '𝑋', 'Y': '𝑌', 'Z': '𝑍',
  'a': '𝑎', 'b': '𝑏', 'c': '𝑐', 'd': '𝑑', 'e': '𝑒', 'f': '𝑓', 'g': '𝑔', 'h': 'ℎ', 'i': '𝑖', 'j': '𝑗', 'k': '𝑘', 'l': '𝑙', 'm': '𝑚',
  'n': '𝑛', 'o': '𝑜', 'p': '𝑝', 'q': '𝑞', 'r': '𝑟', 's': '𝑠', 't': '𝑡', 'u': '𝑢', 'v': '𝑣', 'w': '𝑤', 'x': '𝑥', 'y': '𝑦', 'z': '𝑧',
};

// Create reverse maps for converting back to normal
const reverseMap = (map: { [key: string]: string }): { [key: string]: string } =>
  Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]));

const reverseBoldMap = reverseMap(boldMap);
const reverseItalicMap = reverseMap(italicMap);

const allReverseFormattedMap = { ...reverseBoldMap, ...reverseItalicMap };
// console.log('[formattingUtils] allReverseFormattedMap:', allReverseFormattedMap); // Log this once on load if needed

export const convertToAsciiFormat = (text: string, format: 'bold' | 'italic'): string => {
  const map = format === 'bold' ? boldMap : italicMap;
  let result = '';
  for (const char of text) {
    result += map[char] || char;
  }
  return result;
};

export const convertToNormalFormat = (text: string): string => {
  let result = '';
  for (const char of text) {
    const originalChar = allReverseFormattedMap[char];
    result += originalChar || char;
  }
  return result;
};

// Function to apply formatting to a selected range within a textarea value
export const applyFormatToSelection = (
  currentValue: string,
  selectionStart: number,
  selectionEnd: number,
  formatType: 'bold' | 'italic' | 'normal' // 'normal' is for the eraser
): string => {
  // NOTE: selectionStart and selectionEnd are based on UTF-16 code units,
  // which might not align perfectly with Unicode code points if there are many surrogate pairs.
  // However, for typical text and isolated selections, substring should work reasonably well.
  // A more robust solution for complex Unicode text might involve libraries that understand grapheme clusters.
  const before = currentValue.substring(0, selectionStart);
  const selected = currentValue.substring(selectionStart, selectionEnd);
  const after = currentValue.substring(selectionEnd);

  let transformedSelected;
  if (formatType === 'normal') {
    transformedSelected = convertToNormalFormat(selected);
  } else {
    // If trying to apply bold/italic to already formatted text, 
    // first convert to normal then apply new format to avoid mixed/broken characters.
    // This is a simple approach; more sophisticated logic might be needed for toggling.
    const normalizedSelected = convertToNormalFormat(selected);
    transformedSelected = convertToAsciiFormat(normalizedSelected, formatType);
  }
  return `${before}${transformedSelected}${after}`;
};

// Updated special characters based on the user's image
export const specialCharacters = [
  // Arrows - Row 1 from image
  '→', '←', '↑', '↓', '⇒', '⇐', '⇑', '⇓',
  // Arrows - Row 2 from image (these look like solid vs outline, or different styles)
  // Assuming the image shows: play, reverse play, triangle up, triangle down
  '▶', '◀', '▲', '▼', 
  // Dividers - Row 1 from image
  '•', '|', '|', '|', '‖', '█', '▌', '─',
  // Dividers - Row 2 from image
  '=', '─', '┈', '┄', '┅', '-', '--',
  // Adding a few more potentially useful ones if space allows or for future
  // '❖', '★', '☆', '©', '®', '™' 
];

// It might be better to structure them with labels for the UI:
export const categorizedSpecialCharacters = [
  {
    category: "Arrows",
    symbols: ['→', '←', '↑', '↓', '⇒', '⇐', '⇑', '⇓', '▶', '◀', '▲', '▼']
  },
  {
    category: "Dividers",
    symbols: ['•', '|', '‖', '█', '▌', '─', '=', '┈', '┄', '┅', '-', '--']
  }
  // Add more categories as needed, e.g., "Bullets", "Math", "Currency"
]; 