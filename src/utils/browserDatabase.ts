import { DailyRiskState, PaperPosition, PaperTradeHistory } from '../types.ts';

const DATABASE_NAME = 'quantconsensus-local';
const DATABASE_VERSION = 1;
const ACCOUNT_STORE = 'appData';
const ACCOUNT_KEY = 'account';

export interface StoredAccount {
  paperBalance: number;
  startingBalance?: number;
  openPositions?: PaperPosition[];
  openPosition?: PaperPosition | null;
  tradeHistory: PaperTradeHistory[];
  dailyRiskState?: DailyRiskState;
  lastAutoTradeCandles?: Record<string, number>;
  symbol: string;
  interval: string;
  audioEnabled: boolean;
}

interface AccountRecord extends StoredAccount {
  id: string;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('This browser does not support local IndexedDB storage.'));
      return;
    }

    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(ACCOUNT_STORE)) {
        database.createObjectStore(ACCOUNT_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open local database.'));
    request.onblocked = () => reject(new Error('Local database upgrade is blocked by another tab.'));
  });
}

export async function loadStoredAccount(): Promise<StoredAccount | null> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(ACCOUNT_STORE, 'readonly');
      const request = transaction.objectStore(ACCOUNT_STORE).get(ACCOUNT_KEY);
      request.onsuccess = () => {
        const record = request.result as AccountRecord | undefined;
        if (!record) {
          resolve(null);
          return;
        }

        const { id, ...account } = record;
        void id;
        const openPositions = account.openPositions ?? (account.openPosition ? [account.openPosition] : []);
        resolve({
          ...account,
          openPositions: openPositions.map((position) => {
            const breakEvenStopActive = position.breakEvenStopActive ??
              (position.status === 'TP1_HIT' || position.status === 'TP2_HIT');
            return {
              ...position,
              initialSize: position.initialSize ?? position.size,
              realizedPnl: position.realizedPnl ?? 0,
              breakEvenStopActive,
              stopLoss: position.status === 'TP1_HIT' || position.status === 'TP2_HIT'
                ? position.takeProfit1
                : position.stopLoss,
            };
          }),
        });
      };
      request.onerror = () => reject(request.error ?? new Error('Could not read local account data.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Local database read was aborted.'));
    });
  } finally {
    database.close();
  }
}

export async function saveStoredAccount(account: StoredAccount): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(ACCOUNT_STORE, 'readwrite');
      transaction.objectStore(ACCOUNT_STORE).put({ ...account, id: ACCOUNT_KEY } satisfies AccountRecord);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not save local account data.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Local database write was aborted.'));
    });
  } finally {
    database.close();
  }
}
