import mongoose from 'mongoose';

const virtualWalletSchema = new mongoose.Schema({
  _id: { type: String, default: 'primary' },
  balance: { type: Number, default: 10_000 },
  availableMargin: { type: Number, default: 10_000 },
  inTradeMargin: { type: Number, default: 0 },
  totalRealizedPnl: { type: Number, default: 0 },
  winCount: { type: Number, default: 0 },
  lossCount: { type: Number, default: 0 },
  dayStartEquity: { type: Number, default: 10_000 },
  dailyRealizedPnl: { type: Number, default: 0 },
  consecutiveLosses: { type: Number, default: 0 },
  circuitBreakerDate: { type: String, default: '' },
  circuitBreakerReason: { type: String, default: '' },
  lastAutoTradeCandles: { type: Map, of: Number, default: () => new Map() },
}, { timestamps: true });

export default mongoose.models.VirtualWallet ||
  mongoose.model('VirtualWallet', virtualWalletSchema);
