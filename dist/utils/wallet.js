"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ACTIVITY_POINTS = exports.MIN_REDEMPTION_POINTS = exports.POINT_VALUE_RUPEES = void 0;
exports.ensureWallet = ensureWallet;
exports.getActivityPoints = getActivityPoints;
exports.creditPoints = creditPoints;
exports.debitPoints = debitPoints;
exports.pointsToRupees = pointsToRupees;
exports.maxRedeemablePoints = maxRedeemablePoints;
exports.scoreToTestPoints = scoreToTestPoints;
exports.isFirestoreTimestamp = isFirestoreTimestamp;
exports.mapLedgerDoc = mapLedgerDoc;
const firestore_1 = require("firebase-admin/firestore");
const firebase_1 = require("../config/firebase");
exports.POINT_VALUE_RUPEES = 0.1;
exports.MIN_REDEMPTION_POINTS = 100;
exports.DEFAULT_ACTIVITY_POINTS = {
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
async function ensureWallet(userId) {
    const walletRef = firebase_1.db.collection("wallets").doc(userId);
    const walletSnap = await walletRef.get();
    if (!walletSnap.exists) {
        const now = firestore_1.FieldValue.serverTimestamp();
        const payload = {
            user_id: userId,
            balance: 0,
            total_earned: 0,
            total_redeemed: 0,
            last_updated: now,
        };
        await walletRef.set(payload);
        return payload;
    }
    const data = walletSnap.data();
    return {
        user_id: userId,
        balance: Number(data?.balance ?? 0),
        total_earned: Number(data?.total_earned ?? 0),
        total_redeemed: Number(data?.total_redeemed ?? 0),
        last_updated: data?.last_updated ?? firestore_1.FieldValue.serverTimestamp(),
    };
}
function addMonths(date, months) {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
}
function getActivityPoints(activity, explicitPoints) {
    if (typeof explicitPoints === "number" && explicitPoints > 0) {
        return explicitPoints;
    }
    return exports.DEFAULT_ACTIVITY_POINTS[activity] ?? 0;
}
async function creditPoints(params) {
    const { userId, activity, points, refId = null, description = activity, expiresInMonths = 12, allowDuplicate = false, } = params;
    if (points <= 0) {
        throw new Error("Points must be greater than zero");
    }
    const walletRef = firebase_1.db.collection("wallets").doc(userId);
    if (!allowDuplicate) {
        const existing = await firebase_1.db
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
    const ledgerRef = firebase_1.db.collection("points_ledger").doc();
    const result = await firebase_1.db.runTransaction(async (transaction) => {
        const walletSnap = await transaction.get(walletRef);
        const walletData = walletSnap.data();
        const currentBalance = Number(walletData?.balance ?? 0);
        const currentEarned = Number(walletData?.total_earned ?? 0);
        const newBalance = currentBalance + points;
        if (!walletSnap.exists) {
            transaction.set(walletRef, {
                user_id: userId,
                balance: newBalance,
                total_earned: points,
                total_redeemed: 0,
                last_updated: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        else {
            transaction.update(walletRef, {
                balance: newBalance,
                total_earned: currentEarned + points,
                last_updated: firestore_1.FieldValue.serverTimestamp(),
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
            expires_at: expiresInMonths > 0 ?
                firestore_1.Timestamp.fromDate(addMonths(new Date(), expiresInMonths)) :
                null,
            created_at: firestore_1.FieldValue.serverTimestamp(),
        });
        return { balance: newBalance, transactionId: ledgerRef.id };
    });
    return result;
}
async function debitPoints(params) {
    const { userId, activity = "REDEMPTION", points, refId = null, description = activity, } = params;
    if (points <= 0) {
        throw new Error("Points must be greater than zero");
    }
    const walletRef = firebase_1.db.collection("wallets").doc(userId);
    const ledgerRef = firebase_1.db.collection("points_ledger").doc();
    return firebase_1.db.runTransaction(async (transaction) => {
        const walletSnap = await transaction.get(walletRef);
        const walletData = walletSnap.data();
        const currentBalance = Number(walletData?.balance ?? 0);
        const currentRedeemed = Number(walletData?.total_redeemed ?? 0);
        if (currentBalance < points) {
            throw new Error("Insufficient wallet balance");
        }
        const newBalance = currentBalance - points;
        transaction.set(walletRef, {
            user_id: userId,
            balance: newBalance,
            total_earned: Number(walletData?.total_earned ?? 0),
            total_redeemed: currentRedeemed + points,
            last_updated: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
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
            created_at: firestore_1.FieldValue.serverTimestamp(),
        });
        return { balance: newBalance, transactionId: ledgerRef.id };
    });
}
function pointsToRupees(points) {
    return Number((points * exports.POINT_VALUE_RUPEES).toFixed(2));
}
function maxRedeemablePoints(coursePrice) {
    const maxDiscount = coursePrice * 0.5;
    return Math.floor(maxDiscount / exports.POINT_VALUE_RUPEES);
}
function scoreToTestPoints(scorePercentage) {
    if (scorePercentage >= 80) {
        return exports.DEFAULT_ACTIVITY_POINTS.TEST_COMPLETE_HIGH;
    }
    if (scorePercentage >= 50) {
        return exports.DEFAULT_ACTIVITY_POINTS.TEST_COMPLETE_MEDIUM;
    }
    return exports.DEFAULT_ACTIVITY_POINTS.TEST_COMPLETE_LOW;
}
function isFirestoreTimestamp(value) {
    return value instanceof firestore_1.Timestamp;
}
function mapLedgerDoc(doc) {
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
//# sourceMappingURL=wallet.js.map