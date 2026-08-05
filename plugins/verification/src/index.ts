/**
 * Zone Plugin — License Verification
 * Handles professional license upload and verification.
 * Visual channel only.
 */
import { definePlugin, type ZoneSDK } from '@zone/sdk';

export default function createVerificationPlugin(sdk: ZoneSDK): ReturnType<typeof definePlugin> {
  return definePlugin({
    name: 'zone-verification',
    displayName: 'تأیید مجوز',
    version: '1.0.0',
    description: 'Professional license upload and verification via external sites',
    subscriptions: [],
    publications: [],
    models: ['professional_licenses'],
    routes: [
      {
        path: '/verification',
        widget: 'LicenseVerification',
        label: 'تأیید مجوز',
        icon: 'shield',
      },
    ],
  }, {
    onEvent: async (event: string, data: any) => {
      // TODO: Implement verification flow
    },
  });
}
