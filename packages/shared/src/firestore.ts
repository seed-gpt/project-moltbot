import { Firestore } from '@google-cloud/firestore';

let fs: Firestore | null = null;

export function getFirestore(): Firestore {
    if (!fs) {
        const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
        fs = new Firestore(projectId ? { projectId } : undefined);
    }
    return fs;
}

/** Terminate the Firestore client and release gRPC connections. */
export async function terminateFirestore(): Promise<void> {
    if (fs) {
        await fs.terminate();
        fs = null;
    }
}
