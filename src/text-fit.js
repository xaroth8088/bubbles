// Search the full size range: a minimum font must never force a word to overflow.
// The predicate can use real browser layout, including loaded fonts and spacing.
export function largestFittingFont(maxFont, fits, precision = .01) {
  if (fits(maxFont)) return maxFont;
  let low = 0, high = maxFont;
  while (high - low > precision) {
    const mid = (low + high) / 2;
    if (fits(mid)) low = mid;
    else high = mid;
  }
  return low;
}

// Whitespace is the only permitted break. Punctuation, hyphens, apostrophes,
// soft hyphens, and long compounds stay with their contiguous word.
export function wholeWords(text) {
  return text.trim().split(/\s+/u).filter(Boolean);
}

export function fitBubbleTerm(el, {maxFont = 18, maxHeight}) {
  const text = el.textContent;
  if (el._fittedText !== text) {
    const words = wholeWords(text);
    el.replaceChildren(...words.flatMap((word, i) => {
      const span = document.createElement('span');
      span.className = 'bubble-word';
      span.textContent = word;
      return i ? [document.createTextNode(' '), span] : [span];
    }));
    el._fittedText = el.textContent;
  }
  // Labels fill their allocated box, so this never depends on the previous
  // font's intrinsic width. Hidden arrival bubbles are fitted on release.
  const width = el.clientWidth - 1;
  if (width <= 0 || maxHeight <= 0) return;
  const words = [...el.children];
  const font = largestFittingFont(maxFont, size => {
    el.style.fontSize = `${size}px`;
    return words.every(word => word.offsetWidth <= width) && el.scrollHeight <= maxHeight;
  });
  el.style.fontSize = `${font}px`;
}
