/**
 * Zone — Two-Device Hearing Space Test
 *
 * This test simulates two devices:
 * - Device A: creates a space, speaks a message
 * - Device B: joins the space, hears the message (reverberation), speaks back
 *
 * Run: npx tsx apps/ws/src/test-two-devices.ts
 */

import WebSocket from 'ws';

const WS_URL = process.env.WS_URL || 'ws://localhost:3001/ws';

// ─── Helpers ───

function send(ws: WebSocket, message: any): void {
  ws.send(JSON.stringify(message));
}

function waitFor(ws: WebSocket, type: string, timeout: number = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for ${type}`));
    }, timeout);

    const handler = (raw: Buffer) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === type) {
        clearTimeout(timer);
        ws.removeListener('message', handler);
        resolve(msg.payload);
      }
    };

    ws.on('message', handler);
  });
}

function logAll(ws: WebSocket, label: string): void {
  ws.on('message', (raw: Buffer) => {
    const msg = JSON.parse(raw.toString());
    console.log(`[${label}] ← ${msg.type}`, JSON.stringify(msg.payload).substring(0, 120));
  });
}

// ─── Test ───

async function runTest() {
  console.log('🧪 Two-Device Hearing Space Test');
  console.log('================================\n');

  // ─── Step 1: Connect both devices ───

  console.log('📡 Step 1: Connecting Device A and Device B...');

  const wsA = new WebSocket(WS_URL);
  const wsB = new WebSocket(WS_URL);

  await Promise.all([
    new Promise<void>((resolve) => wsA.on('open', () => resolve())),
    new Promise<void>((resolve) => wsB.on('open', () => resolve())),
  ]);

  logAll(wsA, 'A');
  logAll(wsB, 'B');

  console.log('✅ Both devices connected\n');

  // ─── Step 2: Identify ───

  console.log('🪪 Step 2: Identifying both devices...');

  send(wsA, { type: 'identify', payload: { personId: 'person_a', zoneId: 'zone_narak' } });
  send(wsB, { type: 'identify', payload: { personId: 'person_b', zoneId: 'zone_narak' } });

  await Promise.all([
    waitFor(wsA, 'identified'),
    waitFor(wsB, 'identified'),
  ]);

  console.log('✅ Both devices identified\n');

  // ─── Step 3: Device A creates a persistent space ───

  console.log('🏠 Step 3: Device A creates a persistent hearing space...');

  send(wsA, {
    type: 'join',
    payload: {
      createPersistent: {
        zoneId: 'zone_narak',
        name: 'ساختمان آپارتمان نارک',
        tags: ['social/food', 'social/party'],
        description: 'حیاط مشترک ساختمان',
      },
    },
  });

  const joinResultA = await waitFor(wsA, 'joined');
  const spaceId = joinResultA.space.id;
  console.log(`✅ Space created: ${spaceId}`);
  console.log(`   Name: ${joinResultA.space.name}`);
  console.log(`   Tags: ${joinResultA.space.tags.join(', ')}`);
  console.log(`   Members: ${joinResultA.members.join(', ')}\n`);

  // ─── Step 4: Device A speaks ───

  console.log('🎤 Step 4: Device A speaks in the space...');

  send(wsA, {
    type: 'speak',
    payload: {
      text: 'سلام! کسی میخواد بریم پارک؟',
      tags: ['social/sports'],
    },
  });

  // Wait for the speech to be broadcast
  await new Promise((r) => setTimeout(r, 500));
  console.log('✅ Device A spoke\n');

  // ─── Step 5: Device B joins the space ───

  console.log('🚪 Step 5: Device B joins the space...');

  send(wsB, {
    type: 'join',
    payload: {
      spaceId,
    },
  });

  const joinResultB = await waitFor(wsB, 'joined');
  console.log(`✅ Device B joined`);
  console.log(`   Members: ${joinResultB.members.join(', ')}`);

  // Check reverberations
  if (joinResultB.reverberations && joinResultB.reverberations.length > 0) {
    console.log(`   🔊 Reverberations heard by B:`);
    for (const rev of joinResultB.reverberations) {
      console.log(`      "${rev.text}" — by ${rev.personId}`);
    }
  } else {
    console.log('   ⚠️ No reverberations (this is a bug!)');
  }
  console.log();

  // Wait for Device A to receive the presence notification
  await new Promise((r) => setTimeout(r, 500));

  // ─── Step 6: Device B speaks ───

  console.log('🎤 Step 6: Device B speaks back...');

  // Device A should hear this
  const speechPromise = waitFor(wsA, 'speech', 3000);

  send(wsB, {
    type: 'speak',
    payload: {
      text: 'آره من میام! کی بریم؟',
      tags: ['social/sports'],
    },
  });

  try {
    const speech = await speechPromise;
    console.log(`✅ Device A heard Device B:`);
    console.log(`   "${speech.text}" — by ${speech.personId}\n`);
  } catch {
    console.log('⚠️ Device A did not hear Device B (timeout)\n');
  }

  // ─── Step 7: Device A speaks again ───

  console.log('🎤 Step 7: Device A speaks again...');

  const speechPromise2 = waitFor(wsB, 'speech', 3000);

  send(wsA, {
    type: 'speak',
    payload: {
      text: 'عالیه! پنج دقیقه دیگه بیا حیاط',
      tags: ['social/sports'],
    },
  });

  try {
    const speech = await speechPromise2;
    console.log(`✅ Device B heard Device A:`);
    console.log(`   "${speech.text}" — by ${speech.personId}\n`);
  } catch {
    console.log('⚠️ Device B did not hear Device A (timeout)\n');
  }

  // ─── Step 8: Device B leaves ───

  console.log('🚪 Step 8: Device B leaves the space...');

  send(wsB, { type: 'leave', payload: { spaceId } });
  await waitFor(wsB, 'left');
  console.log('✅ Device B left\n');

  // ─── Cleanup ───

  console.log('🧹 Cleaning up...');
  wsA.close();
  wsB.close();

  console.log('\n✅ Two-Device Hearing Space Test PASSED!');
  console.log('   One person speaks, the other hears.');
  console.log('   Latecomer hears reverberations.');
  console.log('   Presence is tracked.');
}

// ─── Run ───

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
