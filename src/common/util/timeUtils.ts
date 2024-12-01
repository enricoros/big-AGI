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

export function getTimeBucketEn(itemTimeStamp: number, midnightTimestamp: number): string {
  const oneHour = 60 * 60 * 1000;
  const oneDay = oneHour * 24;
  const oneWeek = oneDay * 7;
  const oneMonth = oneDay * 30; // approximation

  // relative time
  const relDiff = Date.now() - itemTimeStamp;
  if (relDiff < oneHour)
    return 'Last Hour';

  // midnight-relative time
  const diff = midnightTimestamp - itemTimeStamp;
  if (diff < oneDay) {
    // if (diff > oneDay / 2)
    //   return 'This morning';
    // else if (diff > oneDay / 4)
    //   return 'This afternoon';
    // else
    //   return 'This evening';
    return 'Today';
  } else if (diff < oneDay * 2) {
    return 'Yesterday';
  } else if (diff < oneDay * 3) {
    return 'Two Days Ago';
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