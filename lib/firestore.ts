import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  where,
  Timestamp,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "./firebase";
import type { Case, Category, TimeEntry, CaseStatus } from "./types";

// ──────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────

const userCol = (userId: string, col: string) =>
  collection(getFirebaseDb(), "users", userId, col);

const toDate = (v: Timestamp | Date | undefined): Date =>
  v instanceof Timestamp ? v.toDate() : (v ?? new Date());

// ──────────────────────────────────────────
// Categories
// ──────────────────────────────────────────

export const subscribeCategories = (
  userId: string,
  cb: (cats: Category[]) => void
): Unsubscribe => {
  const q = query(userCol(userId, "categories"), orderBy("name"));
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Category, "id">) })))
  );
};

export const addCategory = async (userId: string, data: Omit<Category, "id">) => {
  console.log("[Firestore] addCategory start", { userId, data });
  const colRef = userCol(userId, "categories");
  console.log("[Firestore] collection path:", colRef.path);
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Firestore-tilkobling timeout etter 8 sekunder")), 8000)
  );
  const result = await Promise.race([addDoc(colRef, data), timeout]);
  console.log("[Firestore] addCategory success", result);
  return result;
};

export const updateCategory = (
  userId: string,
  catId: string,
  data: Partial<Omit<Category, "id">>
) => updateDoc(doc(getFirebaseDb(), "users", userId, "categories", catId), data);

export const deleteCategory = (userId: string, catId: string) =>
  deleteDoc(doc(getFirebaseDb(), "users", userId, "categories", catId));

// ──────────────────────────────────────────
// Cases
// ──────────────────────────────────────────

const caseFromDoc = (d: { id: string; data: () => Record<string, unknown> }): Case => {
  const data = d.data();
  return {
    id: d.id,
    title: data.title as string,
    description: data.description as string,
    categoryId: data.categoryId as string,
    status: data.status as CaseStatus,
    createdAt: toDate(data.createdAt as Timestamp),
    updatedAt: toDate(data.updatedAt as Timestamp),
    startDate: data.startDate ? toDate(data.startDate as Timestamp) : undefined,
    deadline: data.deadline ? toDate(data.deadline as Timestamp) : undefined,
    contactName: (data.contactName as string) || undefined,
    contactInfo: (data.contactInfo as string) || undefined,
    notes: (data.notes as string) || undefined,
    isPaid: (data.isPaid as boolean) ?? false,
    honorar: (data.honorar as number) || undefined,
    honorarPaid: (data.honorarPaid as boolean) ?? false,
  };
};

export const subscribeCases = (
  userId: string,
  cb: (cases: Case[]) => void
): Unsubscribe => {
  const q = query(userCol(userId, "cases"), orderBy("updatedAt", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map(caseFromDoc)));
};

export const addCase = (
  userId: string,
  data: Omit<Case, "id" | "createdAt" | "updatedAt">
) => {
  const now = Timestamp.now();
  return addDoc(userCol(userId, "cases"), {
    ...data,
    startDate: data.startDate ? Timestamp.fromDate(data.startDate) : null,
    deadline: data.deadline ? Timestamp.fromDate(data.deadline) : null,
    createdAt: now,
    updatedAt: now,
  });
};

export const updateCase = (
  userId: string,
  caseId: string,
  data: Partial<Omit<Case, "id" | "createdAt">>
) =>
  updateDoc(doc(getFirebaseDb(), "users", userId, "cases", caseId), {
    ...data,
    startDate: data.startDate ? Timestamp.fromDate(data.startDate) : null,
    deadline: data.deadline ? Timestamp.fromDate(data.deadline) : null,
    updatedAt: Timestamp.now(),
  });

export const deleteCase = (userId: string, caseId: string) =>
  deleteDoc(doc(getFirebaseDb(), "users", userId, "cases", caseId));

export const getCase = async (userId: string, caseId: string): Promise<Case | null> => {
  const snap = await getDoc(doc(getFirebaseDb(), "users", userId, "cases", caseId));
  if (!snap.exists()) return null;
  return caseFromDoc({ id: snap.id, data: snap.data.bind(snap) });
};

// ──────────────────────────────────────────
// Time Entries
// ──────────────────────────────────────────

const entryFromDoc = (d: { id: string; data: () => Record<string, unknown> }): TimeEntry => {
  const data = d.data();
  return {
    id: d.id,
    caseId: data.caseId as string,
    date: toDate(data.date as Timestamp),
    startTime: data.startTime as string | undefined,
    endTime: data.endTime as string | undefined,
    durationMinutes: data.durationMinutes as number,
    description: data.description as string,
    createdAt: toDate(data.createdAt as Timestamp),
  };
};

export const subscribeTimeEntries = (
  userId: string,
  cb: (entries: TimeEntry[]) => void,
  caseId?: string
): Unsubscribe => {
  let q = query(userCol(userId, "timeEntries"), orderBy("date", "desc"));
  if (caseId) {
    q = query(
      userCol(userId, "timeEntries"),
      where("caseId", "==", caseId),
      orderBy("date", "desc")
    );
  }
  return onSnapshot(q, (snap) => cb(snap.docs.map(entryFromDoc)));
};

export const getAllTimeEntries = async (userId: string): Promise<TimeEntry[]> => {
  const q = query(userCol(userId, "timeEntries"), orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(entryFromDoc);
};

export const addTimeEntry = (
  userId: string,
  data: Omit<TimeEntry, "id" | "createdAt">
) =>
  addDoc(userCol(userId, "timeEntries"), {
    ...data,
    date: Timestamp.fromDate(data.date),
    createdAt: Timestamp.now(),
  });

export const updateTimeEntry = (
  userId: string,
  entryId: string,
  data: Partial<Omit<TimeEntry, "id" | "createdAt">>
) =>
  updateDoc(doc(getFirebaseDb(), "users", userId, "timeEntries", entryId), {
    ...data,
    date: data.date ? Timestamp.fromDate(data.date) : undefined,
  });

export const deleteTimeEntry = (userId: string, entryId: string) =>
  deleteDoc(doc(getFirebaseDb(), "users", userId, "timeEntries", entryId));
