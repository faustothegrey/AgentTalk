import { GoogleDriveService } from './service.js';

export function createGoogleDriveServiceFromEnv(): GoogleDriveService {
  return new GoogleDriveService();
}
