import {
  FieldValue,
  QueryDocumentSnapshot,
  Timestamp,
} from "firebase-admin/firestore";
import { db } from "../config/firebase";

export const POINT_VALUE_RUPEES = 0.1;
export const MIN_REDEMPTION_POINTS = 100;

export const DEFAULT_ACTIVITY_POINTS: Record<string, number> = {
  REGISTRATION: 50,
  DAILY_LOGIN: 5,
  REFERRAL_BONUS: 200,
  FIRST_PURCHASE_BONUS: 100,
  TEST_COMPLETE_LOW: 10,
  TEST_COMPLETE_MEDIUM: 20,
  TEST_COMPLETE_HIGH: 30,
  RANK_FIRST: 100,
  CHAPTER_COMPLETE: 15,
  COURSE_COMPLETE: 150,
  LIVE_CLASS: 20,
  PROFILE_COMPLETE: 25,
  COURSE_RATING: 10,
};

export type WalletSummary = {
  user_id: string;
  balance: number;
  total_earned: number;
  total_redeemed: number;
  last_updated: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
};

export async function ensureWallet(userId: string): Promise<WalletSummary> {
  const walletRef = db.collection("wallets").doc(userId);
  const walletSnap = await walletRef.get();

  if (!walletSnap.exists) {
    const now = FieldValue.serverTimestamp();
    const payload: WalletSummary = {
      user_id: userId,
      balance: 0,
      total_earned: 0,
      total_redeemed: 0,
      last_updated: now,
    };
    await walletRef.set(payload);
    return payload;
  }

  const data = walletSnap.data() as Partial<WalletSummary> | undefined;
  return {
    user_id: userId,
    balance: Number(data?.balance ?? 0),
    total_earned: Number(data?.total_earned ?? 0),
    total_redeemed: Number(data?.total_redeemed ?? 0),
    last_updated: data?.last_updated ?? FieldValue.serverTimestamp(),
  };
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function getActivityPoints(
  activity: string,
  explicitPoints?: number,
): number {
  if (typeof explicitPoints === "number" && explicitPoints > 0) {
    return explicitPoints;
  }
  return DEFAULT_ACTIVITY_POINTS[activity] ?? 0;
}

export async function creditPoints(params: {
  userId: string;
  activity: string;
  points: number;
  refId?: string | null;
  description?: string;
  expiresInMonths?: number;
  allowDuplicate?: boolean;
}): Promise<{ balance: number; transactionId: string | null }> {
  const {
    userId,
    activity,
    points,
    refId = null,
    description = activity,
    expiresInMonths = 12,
    allowDuplicate = false,
  } = params;

  if (points <= 0) {
    throw new Error("Points must be greater than zero");
  }

  const walletRef = db.collection("wallets").doc(userId);

  if (!allowDuplicate) {
    const existing = await db
      .collection("points_ledger")
      .where("user_id", "==", userId)
      .where("activity", "==", activity)
      .where("ref_id", "==", refId)
      .limit(1)
      .get();

    if (!existing.empty) {
      const doc = existing.docs[0].data();
      return {
        balance: Number(doc.balance_after ?? 0),
        transactionId: existing.docs[0].id,
      };
    }
  }

  const ledgerRef = db.collection("points_ledger").doc();
  const result = await db.runTransaction(async (transaction) => {
    const walletSnap = await transaction.get(walletRef);
    const walletData = walletSnap.data() as Partial<WalletSummary> | undefined;
    const currentBalance = Number(walletData?.balance ?? 0);
    const currentEarned = Number(walletData?.total_earned ?? 0);
    const newBalance = currentBalance + points;

    if (!walletSnap.exists) {
      transaction.set(walletRef, {
        user_id: userId,
        balance: newBalance,
        total_earned: points,
        total_redeemed: 0,
        last_updated: FieldValue.serverTimestamp(),
      });
    } else {
      transaction.update(walletRef, {
        balance: newBalance,
        total_earned: currentEarned + points,
        last_updated: FieldValue.serverTimestamp(),
      });
    }

    transaction.set(ledgerRef, {
      id: ledgerRef.id,
      user_id: userId,
      txn_type: "credit",
      activity,
      points,
      balance_after: newBalance,
      ref_id: refId,
      description,
      expires_at:
        expiresInMonths > 0 ?
          Timestamp.fromDate(addMonths(new Date(), expiresInMonths)) :
          null,
      created_at: FieldValue.serverTimestamp(),
    });

    return { balance: newBalance, transactionId: ledgerRef.id };
  });

  return result;
}

export async function debitPoints(params: {
  userId: string;
  activity?: string;
  points: number;
  refId?: string | null;
  description?: string;
}): Promise<{ balance: number; transactionId: string }> {
  const {
    userId,
    activity = "REDEMPTION",
    points,
    refId = null,
    description = activity,
  } = params;

  if (points <= 0) {
    throw new Error("Points must be greater than zero");
  }

  const walletRef = db.collection("wallets").doc(userId);
  const ledgerRef = db.collection("points_ledger").doc();

  return db.runTransaction(async (transaction) => {
    const walletSnap = await transaction.get(walletRef);
    const walletData = walletSnap.data() as Partial<WalletSummary> | undefined;
    const currentBalance = Number(walletData?.balance ?? 0);
    const currentRedeemed = Number(walletData?.total_redeemed ?? 0);

    if (currentBalance < points) {
      throw new Error("Insufficient wallet balance");
    }

    const newBalance = currentBalance - points;
    transaction.set(
      walletRef,
      {
        user_id: userId,
        balance: newBalance,
        total_earned: Number(walletData?.total_earned ?? 0),
        total_redeemed: currentRedeemed + points,
        last_updated: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    transaction.set(ledgerRef, {
      id: ledgerRef.id,
      user_id: userId,
      txn_type: "debit",
      activity,
      points,
      balance_after: newBalance,
      ref_id: refId,
      description,
      expires_at: null,
      created_at: FieldValue.serverTimestamp(),
    });

    return { balance: newBalance, transactionId: ledgerRef.id };
  });
}

export function pointsToRupees(points: number): number {
  return Number((points * POINT_VALUE_RUPEES).toFixed(2));
}

export function maxRedeemablePoints(coursePrice: number): number {
  const maxDiscount = coursePrice * 0.5;
  return Math.floor(maxDiscount / POINT_VALUE_RUPEES);
}

export function scoreToTestPoints(scorePercentage: number): number {
  if (scorePercentage >= 80) {
    return DEFAULT_ACTIVITY_POINTS.TEST_COMPLETE_HIGH;
  }
  if (scorePercentage >= 50) {
    return DEFAULT_ACTIVITY_POINTS.TEST_COMPLETE_MEDIUM;
  }
  return DEFAULT_ACTIVITY_POINTS.TEST_COMPLETE_LOW;
}

export function isFirestoreTimestamp(
  value: unknown,
): value is FirebaseFirestore.Timestamp {
  return value instanceof Timestamp;
}

export function mapLedgerDoc(
  doc: QueryDocumentSnapshot<FirebaseFirestore.DocumentData>,
) {
  const data = doc.data();
  const createdAt = isFirestoreTimestamp(data.created_at) ?
    data.created_at.toDate().toISOString() :
    null;
  const expiresAt = isFirestoreTimestamp(data.expires_at) ?
    data.expires_at.toDate().toISOString() :
    null;

  return {
    id: doc.id,
    ...data,
    created_at: createdAt,
    expires_at: expiresAt,
  };
}
