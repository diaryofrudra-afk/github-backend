const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigit(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const r = n % 10;
  return r ? `${TENS[t]} ${ONES[r]}` : TENS[t];
}

function threeDigit(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${ONES[h]} Hundred`);
  if (r) parts.push(twoDigit(r));
  return parts.join(' ');
}

export function numberToIndianWords(amount: number): string {
  if (!isFinite(amount)) return '';
  const negative = amount < 0;
  const abs = Math.abs(Math.round(amount * 100) / 100);
  const rupees = Math.floor(abs);
  const paise = Math.round((abs - rupees) * 100);

  let words = '';
  if (rupees === 0) {
    words = 'Zero';
  } else {
    const crore = Math.floor(rupees / 10000000);
    const lakh = Math.floor((rupees % 10000000) / 100000);
    const thousand = Math.floor((rupees % 100000) / 1000);
    const rest = rupees % 1000;
    const parts: string[] = [];
    if (crore) parts.push(`${twoDigit(crore)} Crore`);
    if (lakh) parts.push(`${twoDigit(lakh)} Lakh`);
    if (thousand) parts.push(`${twoDigit(thousand)} Thousand`);
    if (rest) parts.push(threeDigit(rest));
    words = parts.join(' ').trim();
  }

  let out = `${words} ${rupees === 1 ? 'Rupee' : 'Rupees'}`;
  if (paise > 0) {
    out += ` and ${twoDigit(paise)} ${paise === 1 ? 'Paisa' : 'Paise'}`;
  }
  out += ' Only';
  return negative ? `Minus ${out}` : out;
}
