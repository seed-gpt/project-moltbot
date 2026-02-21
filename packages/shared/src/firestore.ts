import { Firestore } from '@google-cloud/firestore';

let fs: Firestore | null = null;

export function getFirestore(): Firestore {
    if (!fs) {
        const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
        fs = new Firestore(projectId ? { projectId } : undefined);
    }
    return fs;
}
