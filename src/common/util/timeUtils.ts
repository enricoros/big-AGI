export function prettyTimestampForFilenames(useSeconds: boolean = true) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0'); // JavaScript months are 0-based.
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}-${hour}${minute}${useSeconds ? second : ''}`; // YYYY-MM-DD_HHMM[SS] format
}

export function getLocalMidnightInUTCTimestamp(): number {
  const midnight = new Date();
  // midnight.setDate(midnight.getDate() - 1);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime();
}

export function getTimeBucketEn(currentTimestamp: number, midnightTimestamp: number): string {
  const oneDay = 24 * 60 * 60 * 1000;
  const oneWeek = oneDay * 7;
  const oneMonth = oneDay * 30; // approximation

  const diff = midnightTimestamp - currentTimestamp;

  if (diff < oneDay) {
    return 'Today';
  } else if (diff < oneDay * 2) {
    return 'Yesterday';
  } else if (diff < oneWeek) {
    return 'This Week';
  } else if (diff < oneWeek * 2) {
    return 'Last Week';
  } else if (diff < oneMonth) {
    return 'This Month';
  } else if (diff < oneMonth * 2) {
    return 'Last Month';
  } else {
    return 'Older';
  }
}