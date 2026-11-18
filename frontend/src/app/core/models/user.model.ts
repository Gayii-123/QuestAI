export interface QuestUserProfile {
  uid: string;
  email: string;
  displayName: string;
  role?: string;
  jobTitle?: string;
  contractorname?: string;
  isEnabled: boolean;
  photoURL?: string;
  supervisor?: string;
  supervisorName?: string;
  department?: string;
  [key: string]: any;
}
