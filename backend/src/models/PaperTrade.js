import mongoose from 'mongoose';

const paperTradeSchema = new mongoose.Schema({
  symbol: { type: String, required: true, uppercase: true },
  side: { type: String, enum: ['LONG', 'SHORT'], required: true },
  status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN', required: true },
  entryPrice: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 0 },
  initialQuantity: { type: Number, required: true, min: 0 },
  remainingQuantity: { type: Number, required: true, min: 0 },
  margin: { type: Number, required: true, min: 0 },
  stopLoss: { type: Number, required: true, min: 0 },
  tp1Price: { type: Number, required: true, min: 0 },
  tp2Price: { type: Number, required: true, min: 0 },
  tp1Filled: { type: Boolean, default: false },
  realizedPnl: { type: Number, default: 0 },
  closeReason: { type: String, default: '' },
  exitPrice: { type: Number, default: null },
  openedAt: { type: Date, default: Date.now },
  closedAt: { type: Date, default: null },
}, { timestamps: true });

paperTradeSchema.index({ symbol: 1, status: 1 });
paperTradeSchema.index(
  { symbol: 1 },
  { unique: true, partialFilterExpression: { status: 'OPEN' } }
);
paperTradeSchema.index({ status: 1, closedAt: -1 });

export default mongoose.models.PaperTrade ||
  mongoose.model('PaperTrade', paperTradeSchema);
