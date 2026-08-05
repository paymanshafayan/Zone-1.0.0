/**
 * Zone Plugin — Neighbourhood Services
 *
 * Handles service requests, waves, and memory lookup.
 * Voice channel only.
 */

import { definePlugin, type ZoneSDK } from '@zone/sdk';

export default function createServicesPlugin(sdk: ZoneSDK): ReturnType<typeof definePlugin> {
  return definePlugin(
    {
      name: 'zone-services',
      displayName: 'خدمات محله',
      version: '1.0.0',
      description: 'Handles neighbourhood service requests, waves, and memory lookup',
      subscriptions: ['user.speak', 'wave.response', 'wave.open'],
      publications: ['wave.open'],
      models: ['memories', 'requests', 'offers'],
      routes: [],
    },
    {
      onEvent: async (event: string, data: any) => {
        switch (event) {
          case 'user.speak': {
            // Only handle service-related speech
            const hasServiceTag = data.tags?.some((t: string) => t.startsWith('services/'));
            if (!hasServiceTag) return;

            // Route based on intent
            switch (data.intent) {
              case 'know': {
                // Search memories
                const memories = await sdk.data.query('memories', {
                  zoneId: data.zoneId,
                  tags: data.tags,
                  minConfidence: 0.5,
                });
                // TODO: Format and respond via assistant
                break;
              }
              case 'ask': {
                // Open a wave
                await sdk.hearing.openWave({
                  zoneId: data.zoneId,
                  tags: data.tags,
                  radius: 2500,
                  reverberationTtl: 2 * 60 * 60 * 1000, // 2 hours
                });
                break;
              }
              case 'unknown': {
                // Use admit_unknown tool
                // TODO: Implement via assistant
                break;
              }
            }
            break;
          }

          case 'wave.response': {
            // A provider responded to a wave
            // TODO: Track response count and notify requester
            break;
          }

          case 'wave.open': {
            // A new wave was opened
            // TODO: Notify eligible users
            break;
          }
        }
      },

      onDestroy: async () => {
        // Cleanup
      },
    }
  );
}
