import { TestBed } from '@angular/core/testing';
import { ConversationService } from './conversation.service';
import { AuthService } from './auth.service';
import { ChatMessage, Conversation } from '../models/chat.models';

describe('ConversationService — E-IMS Persistent Chat', () => {
  let service: ConversationService;

  const mockAuthService = {
    firestore: {} as any,
    auth: { currentUser: { uid: 'test-user-123' } } as any,
    currentUser: () => ({ uid: 'test-user-123', email: 'inspector@quest.com' } as any),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ConversationService,
        { provide: AuthService, useValue: mockAuthService },
      ],
    });
    service = TestBed.inject(ConversationService);
  });

  it('should be created and identify active user UID', () => {
    expect(service).toBeTruthy();
    expect(service.getCurrentUserId()).toBe('test-user-123');
  });

  it('should sanitize messages for Firestore without large Base64 images', () => {
    const rawMessage: ChatMessage = {
      id: 'msg-1',
      sender: 'user',
      content: 'Here are my inspection site photos',
      timestamp: new Date('2026-11-18T10:00:00Z'),
      photos: [
        {
          id: 'p-1',
          name: 'site-photo.jpg',
          size: 204800,
          url: 'data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          timestamp: '2026-11-18T10:00:00Z',
        },
      ],
      singleQuestion: {
        id: 'q-1',
        qtext: 'Site specific Risk Assessment recorded?',
        isAnswered: false,
      },
    };

    const serialized = (service as any).serializeMessageForFirestore(rawMessage);

    // Document ID and text preserved
    expect(serialized.id).toBe('msg-1');
    expect(serialized.content).toBe('Here are my inspection site photos');

    // Base64 string must NOT be stored in Firestore
    expect(serialized.photos).toBeDefined();
    expect(serialized.photos.length).toBe(1);
    expect(serialized.photos[0].id).toBe('p-1');
    expect(serialized.photos[0].name).toBe('site-photo.jpg');
    expect(serialized.photos[0].size).toBe(204800);
    expect(serialized.photos[0].url).toBe(''); // Stripped!

    // Structured inspection cards preserved intact
    expect(serialized.singleQuestion).toBeDefined();
    expect(serialized.singleQuestion.qtext).toBe('Site specific Risk Assessment recorded?');
    expect(serialized.singleQuestion.isAnswered).toBe(false);
  });

  it('should eliminate undefined properties so Firestore writes do not fail', () => {
    const dirtyObj = {
      title: 'Site Inspection',
      optionalNotes: undefined,
      nested: {
        score: 95,
        missingField: undefined,
      },
    };

    const cleaned = (service as any).cleanForFirestore(dirtyObj);
    expect(cleaned.title).toBe('Site Inspection');
    expect('optionalNotes' in cleaned).toBeFalse();
    expect(cleaned.nested.score).toBe(95);
    expect('missingField' in cleaned.nested).toBeFalse();
  });

  it('should deserialize Firestore conversation preserving "New Chat" default title', () => {
    const firestoreData = {
      title: 'New Chat',
      updatedAt: '2026-11-18T12:00:00Z',
      lastMessagePreview: 'Hello inspector',
      messageCount: 2,
    };

    const conv = (service as any).deserializeConversation('conv-101', firestoreData);
    expect(conv.id).toBe('conv-101');
    expect(conv.title).toBe('New Chat');
    expect(conv.lastMessagePreview).toBe('Hello inspector');
    expect(conv.updatedAt instanceof Date).toBeTrue();
  });
});
