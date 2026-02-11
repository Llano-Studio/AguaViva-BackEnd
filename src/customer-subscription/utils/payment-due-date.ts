export function calculatePaymentDueDate(
  cycleStart: Date,
  cycleEnd: Date,
  paymentMode: string,
  paymentDueDay?: number,
): Date {
  if (paymentMode === 'ADVANCE') {
    return new Date(cycleStart);
  }

  if (paymentDueDay) {
    const paymentDate = new Date(
      cycleEnd.getFullYear(),
      cycleEnd.getMonth(),
      paymentDueDay,
    );

    if (paymentDate <= cycleEnd) {
      paymentDate.setMonth(paymentDate.getMonth() + 1);
    }

    return paymentDate;
  }

  return new Date(cycleEnd);
}

