export const HOLD_TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function getTomorrowAtEightAM(): Date {
  const result = new Date();
  result.setDate(result.getDate() + 1);
  result.setHours(8, 0, 0, 0);
  return result;
}

export function parseTodayTimeInput(timeText: string): Date | null {
  const normalized = timeText.trim();
  const match = HOLD_TIME_REGEX.exec(normalized);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return null;
  }
  const result = new Date();
  result.setHours(hours, minutes, 0, 0);
  // Interpret selected time as the next reactivation time.
  if (result.getTime() <= Date.now()) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}
