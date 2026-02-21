import { Firestore } from '@google-cloud/firestore';

let fs: Firestore | null = null;

export function getFirestore(): Firestore {
    if (!fs) {
        fs = new Firestore();
    }
    return fs;
}
