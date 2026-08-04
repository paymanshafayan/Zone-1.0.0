/**
 * Zone Plugin — Social
 * Handles friendship, activities, and social hearing spaces.
 * Voice channel only.
 */
import { definePlugin, type ZoneSDK } from '@zone/sdk';

export default function createSocialPlugin(sdk: ZoneSDK): ReturnType<typeof definePlugin> {
  return definePlugin({
    name: 'zone-social',
    displayName: 'اجتماعی',
    version: '1.0.0',
    description: 'Social hearing spaces — friendship, activities, neighbourhood talk',
    subscriptions: ['user.speak', 'user.join'],
    publications: [],
    models: ['persons'],
    routes: [],
  }, {
    onEvent: async (event: string, data: any) => {
      // TODO: Implement social features
    },
  });
}
