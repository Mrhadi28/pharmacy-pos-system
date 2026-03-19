/**
 * Format currency in Pakistani Rupees (PKR)
 */
export function formatPKR(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return "₨ 0";
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format date nicely
 */
export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return "N/A";
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-PK", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch (e) {
    return dateString;
  }
}
