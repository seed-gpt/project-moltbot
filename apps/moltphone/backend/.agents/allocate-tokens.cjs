#!/usr/bin/env node
// Allocate 200 tokens to gibtaxi2026 agent
const { Firestore } = require('/Users/roei/dev_workspace/project-moltbot/packages/shared/node_modules/@google-cloud/firestore');

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
const db = new Firestore(projectId ? { projectId } : undefined);

async function main() {
    const snapshot = await db.collection('agents')
        .where('handle', '==', 'gibtaxi2026')
        .limit(1)
        .get();

    if (snapshot.empty) {
        const allAgents = await db.collection('agents').get();
        console.log('Available agents:');
        allAgents.docs.forEach(doc => {
            const d = doc.data();
            console.log(`  - ${doc.id}: handle=${d.handle}, name=${d.name}, email=${d.metadata?.email}`);
        });
        console.error('\nAgent "gibtaxi2026" not found. See above.');
        process.exit(1);
    }

    const agentDoc = snapshot.docs[0];
    const agentId = agentDoc.id;
    console.log(`Found agent: ${agentId} (handle: ${agentDoc.data().handle})`);

    const balRef = db.collection('tokenBalances').doc(agentId);
    const balDoc = await balRef.get();
    const currentBalance = balDoc.exists ? (balDoc.data()?.balance || 0) : 0;
    console.log(`Current balance: ${currentBalance}`);

    await balRef.set({
        agentId,
        balance: currentBalance + 200,
        updatedAt: new Date().toISOString(),
    }, { merge: true });

    console.log(`New balance: ${currentBalance + 200} (+200 tokens allocated)`);
}

main().catch(err => { console.error(err); process.exit(1); });
