import { calculatePaymentDueDate } from './payment-due-date';

function toYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

describe('calculatePaymentDueDate', () => {
  it('ADVANCE vence en cycleStart', () => {
    const cycleStart = new Date(2026, 1, 11);
    cycleStart.setHours(0, 0, 0, 0);
    const cycleEnd = new Date(2026, 2, 8);
    cycleEnd.setHours(0, 0, 0, 0);

    const result = calculatePaymentDueDate(cycleStart, cycleEnd, 'ADVANCE');

    expect(toYmd(result)).toBe('2026-02-11');
  });

  it('ARREARS sin paymentDueDay vence en cycleEnd', () => {
    const cycleStart = new Date(2026, 1, 11);
    cycleStart.setHours(0, 0, 0, 0);
    const cycleEnd = new Date(2026, 2, 8);
    cycleEnd.setHours(0, 0, 0, 0);

    const result = calculatePaymentDueDate(cycleStart, cycleEnd, 'ARREARS');

    expect(toYmd(result)).toBe('2026-03-08');
  });

  it('ARREARS con paymentDueDay antes del cycleEnd se mueve al mes siguiente', () => {
    const cycleStart = new Date(2026, 1, 11);
    cycleStart.setHours(0, 0, 0, 0);
    const cycleEnd = new Date(2026, 2, 8);
    cycleEnd.setHours(0, 0, 0, 0);

    const result = calculatePaymentDueDate(cycleStart, cycleEnd, 'ARREARS', 5);

    expect(toYmd(result)).toBe('2026-04-05');
  });
});
