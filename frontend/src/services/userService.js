import { doc, setDoc } from "firebase/firestore";
import { db } from "../components/firebase";

export const saveUserProfile = async (uid, data) => {
  await setDoc(doc(db, "users", uid), data, { merge: true });
};