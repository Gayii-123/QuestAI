import { Injectable } from '@angular/core';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Analytics, getAnalytics, isSupported } from 'firebase/analytics';
import { environment } from '../../../environments/environment';

/**
 * Initialises the QuestAI Firebase web app (a separate app registered inside the Quest Firebase project).
 * Analytics is started only where the browser supports it.
 */
@Injectable({ providedIn: 'root' })
export class FirebaseService {
  readonly app: FirebaseApp = getApps().length ? getApp() : initializeApp(environment.firebase);
  analytics: Analytics | null = null;

  constructor() {
    isSupported()
      .then((ok) => {
        if (ok) this.analytics = getAnalytics(this.app);
      })
      .catch(() => (this.analytics = null));
  }
}

