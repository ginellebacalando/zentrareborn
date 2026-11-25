/**
 * Zion's GCash and bank accounts, shown only on each client's private payment page (booking
 * automation phase 2, docs/booking-automation.md). An empty account is not offered; with neither
 * account set, clients see the cash instructions only. Shared by the Settings form and the server.
 */
export type PaymentAccounts = {
  gcash: { accountName: string; number: string };
  bank: { bankName: string; accountName: string; accountNumber: string };
};

export type PaymentAccountField =
  'gcashName' | 'gcashNumber' | 'bankName' | 'bankAccountName' | 'bankAccountNumber';

export type OnlinePaymentMethod = 'GCASH' | 'BANK_TRANSFER';

export const EMPTY_PAYMENT_ACCOUNTS: PaymentAccounts = {
  gcash: { accountName: '', number: '' },
  bank: { bankName: '', accountName: '', accountNumber: '' },
};

export const PAYMENT_METHOD_LABELS: Record<OnlinePaymentMethod | 'CASH', string> = {
  CASH: 'Cash at the venue',
  GCASH: 'GCash',
  BANK_TRANSFER: 'Bank transfer',
};

const MOBILE_NUMBER = /^(\+63|0)9\d{9}$/;
const ACCOUNT_NUMBER = /^\d[\d -]{4,28}\d$/;
const NAME_LIMIT = 100;

/** Trims every field; a GCash number loses its spaces and dashes. */
export function normalizePaymentAccounts(accounts: PaymentAccounts): PaymentAccounts {
  return {
    gcash: {
      accountName: accounts.gcash.accountName.trim(),
      number: accounts.gcash.number.replace(/[\s-]/g, ''),
    },
    bank: {
      bankName: accounts.bank.bankName.trim(),
      accountName: accounts.bank.accountName.trim(),
      accountNumber: accounts.bank.accountNumber.trim(),
    },
  };
}

function nameProblem(value: string, label: string) {
  return value.length < 2 || value.length > NAME_LIMIT
    ? `Enter the ${label} (2 to ${NAME_LIMIT} characters).`
    : null;
}

/** The first field to fix and why, or null. Expects normalized accounts. */
export function paymentAccountsProblem(
  accounts: PaymentAccounts,
): { field: PaymentAccountField; problem: string } | null {
  const { gcash, bank } = accounts;
  if (gcash.accountName || gcash.number) {
    const name = nameProblem(gcash.accountName, 'GCash account name');
    if (name) return { field: 'gcashName', problem: name };
    if (!MOBILE_NUMBER.test(gcash.number))
      return {
        field: 'gcashNumber',
        problem: 'Enter the GCash number as 09XXXXXXXXX or +639XXXXXXXXX.',
      };
  }
  if (bank.bankName || bank.accountName || bank.accountNumber) {
    const bankName = nameProblem(bank.bankName, 'bank name');
    if (bankName) return { field: 'bankName', problem: bankName };
    const accountName = nameProblem(bank.accountName, 'bank account name');
    if (accountName) return { field: 'bankAccountName', problem: accountName };
    if (!ACCOUNT_NUMBER.test(bank.accountNumber))
      return {
        field: 'bankAccountNumber',
        problem: 'Enter the bank account number (digits, spaces or dashes).',
      };
  }
  return null;
}

/** The online methods a client can use: only accounts that are fully filled in. */
export function onlinePaymentMethods(accounts: PaymentAccounts): OnlinePaymentMethod[] {
  return [
    ...(accounts.gcash.accountName && accounts.gcash.number ? (['GCASH'] as const) : []),
    ...(accounts.bank.bankName && accounts.bank.accountName && accounts.bank.accountNumber
      ? (['BANK_TRANSFER'] as const)
      : []),
  ];
}

/** A transfer reference as stored: no spaces and in capitals, so the same transfer always matches. */
export function normalizeTransferReference(value: string) {
  return value.replace(/\s+/g, '').toUpperCase();
}

/**
 * The receipt number of a verified transfer. Receipt numbers are unique, so one GCash or bank
 * transfer can never be recorded twice, on this booking or another.
 */
export function transferReceiptNumber(method: OnlinePaymentMethod, reference: string) {
  return `${method === 'GCASH' ? 'GCASH' : 'BANK'}-${normalizeTransferReference(reference)}`;
}
