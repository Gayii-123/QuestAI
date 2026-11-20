import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  Auth,
  User,
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { Firestore, doc, getDoc, getFirestore } from 'firebase/firestore';
import { FirebaseService } from './firebase.service';
import { QuestUserProfile } from '../models/user.model';

const QUEST_USERS_COLLECTION = 'employeesList';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly firebaseService = inject(FirebaseService);
  private readonly router = inject(Router);

  readonly auth: Auth = getAuth(this.firebaseService.app);
  readonly firestore: Firestore = getFirestore(this.firebaseService.app);

  // Reactive state signals
  readonly currentUser = signal<User | null>(null);
  readonly userProfile = signal<QuestUserProfile | null>(null);
  readonly isAuthChecking = signal<boolean>(true);
  readonly authError = signal<string | null>(null);
  readonly isLoggingIn = signal<boolean>(false);

  // Authentication status derived from Firebase user + verified Quest Firestore record
  readonly isAuthenticated = computed(() => {
    const user = this.currentUser();
    const profile = this.userProfile();
    return !!user && !!profile && profile.isEnabled === true;
  });

  // Ready promise for route guards / initial auth resolution
  private authReadyResolver?: (ready: boolean) => void;
  readonly authReadyPromise = new Promise<boolean>((resolve) => {
    this.authReadyResolver = resolve;
  });

  constructor() {
    this.initAuthPersistenceAndListener();
  }

  private async initAuthPersistenceAndListener(): Promise<void> {
    try {
      await setPersistence(this.auth, browserLocalPersistence);
    } catch (err) {
      console.warn('[QuestAI Auth] Error configuring session persistence:', err);
    }

    onAuthStateChanged(this.auth, async (fbUser: User | null) => {
      if (fbUser) {
        try {
          let profile = await this.fetchAndVerifyQuestProfile(fbUser.uid);
          if (profile && !profile.isEnabled) {
            console.warn('[QuestAI Auth] User account is deactivated or disabled');
            await signOut(this.auth);
            this.resetState();
          } else {
            if (!profile) {
              // Standalone mode: fallback to Firebase Auth user profile
              profile = this.createStandaloneProfile(fbUser);
            }
            this.currentUser.set(fbUser);
            this.userProfile.set(profile);
            this.authError.set(null);
          }
        } catch (error) {
          console.error('[QuestAI Auth] Error verifying session on state change:', error);
          await signOut(this.auth);
          this.resetState();
        }
      } else {
        this.resetState();
      }

      this.isAuthChecking.set(false);
      if (this.authReadyResolver) {
        this.authReadyResolver(this.isAuthenticated());
      }
    });
  }

  /**
   * Primary Login Flow:
   * 1. Authenticate with Firebase Authentication using email & password
   * 2. Query Firestore collection `employeesList/{uid}`
   * 3. Verify user document exists and `isEnabled === true`
   * 4. If invalid or inactive, immediately sign out and reject
   */
  async login(email: string, pass: string): Promise<QuestUserProfile> {
    const cleanEmail = email.trim().toLowerCase();
    this.isLoggingIn.set(true);
    this.authError.set(null);

    try {
      // Step 1: Firebase Authentication
      const cred = await signInWithEmailAndPassword(this.auth, cleanEmail, pass);
      const fbUser = cred.user;

      if (!fbUser) {
        throw new Error('Authentication failed: No user returned by service.');
      }

      // Step 2: Verification against existing Quest user collection or standalone fallback
      let profile = await this.fetchAndVerifyQuestProfile(fbUser.uid);

      if (profile && !profile.isEnabled) {
        // User exists in Quest, but is deactivated / disabled
        await signOut(this.auth);
        this.resetState();
        const disabledError = new Error(
          'Access Denied: Your Quest account is currently inactive or deactivated. Please contact your administrator.'
        );
        this.authError.set(disabledError.message);
        throw disabledError;
      }

      if (!profile) {
        // Standalone Mode: fallback to Firebase Auth user profile
        profile = this.createStandaloneProfile(fbUser);
      }

      // Step 3: Grant access & set signals
      this.currentUser.set(fbUser);
      this.userProfile.set(profile);
      this.authError.set(null);
      return profile;
    } catch (err: any) {
      const formattedMessage = this.formatAuthError(err);
      this.authError.set(formattedMessage);
      throw new Error(formattedMessage);
    } finally {
      this.isLoggingIn.set(false);
    }
  }

  /**
   * Fetches user profile directly from Firestore `employeesList/{uid}`
   */
  private async fetchAndVerifyQuestProfile(uid: string): Promise<QuestUserProfile | null> {
    try {
      const userDocRef = doc(this.firestore, QUEST_USERS_COLLECTION, uid);
      const snap = await getDoc(userDocRef);

      if (!snap.exists()) {
        return null;
      }

      const data = snap.data();
      const isEnabled =
        data['isEnabled'] !== false &&
        data['isActive'] !== false &&
        data['status'] !== 'inactive' &&
        data['disabled'] !== true;

      const profile: QuestUserProfile = {
        uid,
        email: data['email'] || '',
        displayName: data['displayName'] || data['name'] || data['fullName'] || 'Quest Inspector',
        role: data['role'] || data['jobTitle'] || data['designation'] || 'Inspector',
        jobTitle: data['jobTitle'] || data['role'] || 'Site Inspector',
        contractorname: data['contractorname'] || data['contractor'] || data['company'] || data['employer'] || 'Quest',
        isEnabled,
        photoURL: data['photoURL'] || data['photoUrl'] || undefined,
        supervisor: data['supervisor'] || undefined,
        supervisorName: data['supervisorName'] || undefined,
        department: data['department'] || undefined,
      };

      return profile;
    } catch (err) {
      console.error('[QuestAI Auth] Error fetching Quest user profile from employeesList:', err);
      return null;
    }
  }

  /**
   * Constructs an isolated standalone profile directly from Firebase Auth user data.
   */
  private createStandaloneProfile(fbUser: User): QuestUserProfile {
    const rawName = fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : 'Quest Inspector');
    const formattedName = rawName
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    return {
      uid: fbUser.uid,
      email: fbUser.email || '',
      displayName: formattedName,
      role: 'QHSE',
      jobTitle: 'Site Inspector',
      contractorname: 'Quest Standalone',
      isEnabled: true,
      photoURL: fbUser.photoURL || undefined,
    };
  }

  /**
   * Signs the user out of Firebase Auth, clears local state, and navigates to /login
   */
  async logout(): Promise<void> {
    try {
      await signOut(this.auth);
    } catch (err) {
      console.warn('[QuestAI Auth] Error during sign-out:', err);
    } finally {
      this.resetState();
      await this.router.navigate(['/login']);
    }
  }

  /**
   * Sends password reset email using Firebase Auth
   */
  async sendPasswordReset(email: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      throw new Error('Please enter a valid email address.');
    }
    try {
      await sendPasswordResetEmail(this.auth, cleanEmail);
    } catch (err: any) {
      throw new Error(this.formatAuthError(err));
    }
  }

  private resetState(): void {
    this.currentUser.set(null);
    this.userProfile.set(null);
    this.authError.set(null);
  }

  private formatAuthError(err: any): string {
    const code = err?.code || '';
    switch (code) {
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/user-disabled':
        return 'This user account has been disabled.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Incorrect email or password. Please verify your credentials.';
      case 'auth/too-many-requests':
        return 'Too many unsuccessful attempts. Access temporarily locked. Please try again later.';
      case 'auth/network-request-failed':
        return 'Network connection error. Please check your internet connection.';
      default:
        return err?.message || 'Authentication failed. Please try again.';
    }
  }
}
