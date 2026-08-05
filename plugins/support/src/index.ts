/**
 * Zone Plugin — Support
 * Handles mutual help, brainstorming, and system suggestions.
 * Voice channel only.
 */
import { definePlugin, type ZoneSDK } from '@zone/sdk';

export default function createSupportPlugin(sdk: ZoneSDK): ReturnType<typeof definePlugin> {
  return definePlugin({
    name: 'zone-support',
    displayName: 'حمایتی',
    version: '1.0.0',
    description: 'Mutual help, brainstorming, and system suggestions',
    subscriptions: ['user.speak'],
    publications: [],
    models: ['memories'],
    routes: [],
  }, {
    onEvent: async (event: string, data: any) => {
      // TODO: Implement support features
    },
  });
}
