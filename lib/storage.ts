import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  type UploadTaskSnapshot,
} from "firebase/storage";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseStorage, getFirebaseDb } from "./firebase";
import type { CaseDocument } from "./types";

const docsCol = (userId: string, caseId: string) =>
  collection(getFirebaseDb(), "users", userId, "cases", caseId, "documents");

export const subscribeCaseDocuments = (
  userId: string,
  caseId: string,
  cb: (docs: CaseDocument[]) => void
): Unsubscribe => {
  const q = query(docsCol(userId, caseId), orderBy("uploadedAt", "desc"));
  return onSnapshot(q, (snap) =>
    cb(
      snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name as string,
          storagePath: data.storagePath as string,
          downloadUrl: data.downloadUrl as string,
          size: data.size as number,
          uploadedAt: (data.uploadedAt as Timestamp).toDate(),
        };
      })
    )
  );
};

export const uploadCaseDocument = (
  userId: string,
  caseId: string,
  file: File,
  onProgress: (pct: number) => void
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._\-æøåÆØÅ ]/g, "_");
    const storagePath = `users/${userId}/cases/${caseId}/${Date.now()}_${safeName}`;
    const storageRef = ref(getFirebaseStorage(), storagePath);
    const task = uploadBytesResumable(storageRef, file);

    task.on(
      "state_changed",
      (snapshot: UploadTaskSnapshot) => {
        onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
      },
      reject,
      async () => {
        try {
          const downloadUrl = await getDownloadURL(task.snapshot.ref);
          await addDoc(docsCol(userId, caseId), {
            name: file.name,
            storagePath,
            downloadUrl,
            size: file.size,
            uploadedAt: Timestamp.now(),
          });
          resolve();
        } catch (err) {
          reject(err);
        }
      }
    );
  });
};

export const deleteCaseDocument = async (
  userId: string,
  caseId: string,
  document: CaseDocument
): Promise<void> => {
  await deleteObject(ref(getFirebaseStorage(), document.storagePath));
  await deleteDoc(doc(getFirebaseDb(), "users", userId, "cases", caseId, "documents", document.id));
};
