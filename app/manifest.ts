import type { MetadataRoute } from 'next';
import { atlasWebManifest } from '@/lib/pwa/manifest';

export default function manifest(): MetadataRoute.Manifest {
  return atlasWebManifest;
}
