import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ChatStateService } from '../core/services/chat-state.service';
import { ReportService } from '../core/services/report.service';
import { AuthService } from '../core/services/auth.service';
import { InspectionReviewDrawerComponent } from '../features/inspection/review-drawer/inspection-review-drawer.component';
import { Conversation } from '../core/models/chat.models';
import { InspectionDraftSummaryViewModel } from '../core/models/inspection-view.models';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterOutlet,
    InspectionReviewDrawerComponent,
  ],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.css'],
})
export class MainLayoutComponent {
  readonly chatState = inject(ChatStateService);
  readonly reportService = inject(ReportService);
  readonly authService = inject(AuthService);
  readonly router = inject(Router);

  // Layout UI State
  readonly mobileSidebarOpen = signal<boolean>(false);
  readonly desktopSidebarCollapsed = signal<boolean>(false);
  readonly sidebarActiveSection = signal<'home' | 'recent-chats' | 'inspection-history' | 'my-reports'>('home');
  readonly recentChatsExpanded = signal<boolean>(true);

  // Deletion modals, three-dot context menu & inline rename state
  readonly conversationToDelete = signal<Conversation | null>(null);
  readonly showClearAllConfirm = signal<boolean>(false);
  readonly activeContextMenuConv = signal<Conversation | null>(null);
  readonly contextMenuPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  readonly editingConvId = signal<string | null>(null);
  readonly editingConvTitle = signal<string>('');

  // Authenticated user computed helpers
  readonly userDisplayName = computed(() => {
    return (
      (this.authService.userProfile() as any)?.name ||
      this.authService.currentUser()?.displayName ||
      'Quest Inspector'
    );
  });

  readonly userInitials = computed(() => {
    const name = this.userDisplayName().trim();
    if (!name) return 'QI';
    const parts = name.split(/\s+/).filter(Boolean);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.substring(0, 2).toUpperCase();
  });

  readonly userRole = computed(() => {
    return (this.authService.userProfile() as any)?.role || 'Safety & Compliance';
  });

  readonly userContractor = computed(() => {
    return (this.authService.userProfile() as any)?.contractor || 'Marlborough Highways';
  });

  readonly currentUrl = signal<string>(this.router.url);

  readonly isChatRoute = computed(() => {
    const url = this.currentUrl();
    return url === '/chat' || url.startsWith('/chat/') || url === '/';
  });

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.currentUrl.set(e.urlAfterRedirects || e.url);
      });
  }

  readonly hasActiveMessages = computed(() => {
    const conv = this.chatState.activeConversation();
    return !!conv && (conv.messages || []).length > 0;
  });

  readonly isHomeActive = computed(() => {
    return (
      this.sidebarActiveSection() === 'home' &&
      this.isChatRoute() &&
      !this.hasActiveMessages()
    );
  });

  // --- Sidebar & Navigation Actions ---

  toggleSidebar(): void {
    if (window.innerWidth <= 900) {
      this.mobileSidebarOpen.update((open) => !open);
    } else {
      this.desktopSidebarCollapsed.update((collapsed) => !collapsed);
    }
  }

  closeMobileSidebar(): void {
    this.mobileSidebarOpen.set(false);
  }

  navigateToHome(): void {
    this.startNewChat();
  }

  startNewChat(): void {
    this.sidebarActiveSection.set('home');
    this.closeConversationMenu();
    this.cancelRenameConv();
    this.chatState.startNewChat();
    this.closeMobileSidebar();
    void this.router.navigate(['/chat']);
  }

  navigateToRecentChats(): void {
    this.sidebarActiveSection.set('recent-chats');
    this.recentChatsExpanded.update((v) => !v);
  }

  navigateToInspectionHistory(): void {
    this.reportService.loadInspectionHistory();
    this.sidebarActiveSection.set('inspection-history');
    this.closeConversationMenu();
    this.closeMobileSidebar();
    void this.router.navigate(['/reports']);
  }

  navigateToMyReports(): void {
    this.reportService.loadInspectionHistory();
    this.sidebarActiveSection.set('my-reports');
    this.closeConversationMenu();
    this.closeMobileSidebar();
    void this.router.navigate(['/reports']);
  }

  selectConversation(id: string): void {
    if (this.editingConvId() === id) return;
    this.closeConversationMenu();
    this.chatState.selectConversation(id);
    this.closeMobileSidebar();
    void this.router.navigate(['/chat', id]);
  }

  openHistoryRecord(record: any): void {
    this.reportService.openHistoryRecord(record);
    this.closeMobileSidebar();
    void this.router.navigate(['/reports']);
  }

  // --- Conversation Deletion Modal ---

  promptDeleteConversation(conv: Conversation, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.closeConversationMenu();
    this.conversationToDelete.set(conv);
  }

  cancelDeleteConversation(): void {
    this.conversationToDelete.set(null);
  }

  confirmDeleteConversation(): void {
    const target = this.conversationToDelete();
    if (!target) return;
    this.chatState.deleteConversation(target.id);
    this.conversationToDelete.set(null);
    if (this.chatState.conversations().length === 0) {
      void this.router.navigate(['/chat']);
    }
  }

  promptClearAllConversations(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.showClearAllConfirm.set(true);
  }

  cancelClearAll(): void {
    this.showClearAllConfirm.set(false);
  }

  confirmClearAll(): void {
    this.chatState.clearAllConversations();
    this.showClearAllConfirm.set(false);
    void this.router.navigate(['/chat']);
  }

  // --- Three-Dot Context Menu & Inline Rename ---

  toggleConversationMenu(conv: Conversation, event: MouseEvent): void {
    event.stopPropagation();
    if (this.activeContextMenuConv()?.id === conv.id) {
      this.closeConversationMenu();
      return;
    }
    const target = event.currentTarget as HTMLElement | null;
    if (target) {
      const rect = target.getBoundingClientRect();
      this.contextMenuPosition.set({
        x: Math.min(rect.left, 148),
        y: Math.min(rect.bottom + 4, window.innerHeight - 110),
      });
    }
    this.activeContextMenuConv.set(conv);
  }

  closeConversationMenu(): void {
    this.activeContextMenuConv.set(null);
  }

  startRenameActiveMenuConv(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    const conv = this.activeContextMenuConv();
    if (!conv) return;
    this.closeConversationMenu();
    this.editingConvId.set(conv.id);
    this.editingConvTitle.set(conv.title);
    setTimeout(() => {
      const inputEl = document.getElementById('conv-rename-input-' + conv.id) as HTMLInputElement | null;
      if (inputEl) {
        inputEl.focus();
        inputEl.select();
      }
    }, 20);
  }

  saveRenameConv(conv: Conversation, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const trimmed = this.editingConvTitle().trim();
    if (trimmed && trimmed !== conv.title) {
      this.chatState.renameConversation(conv.id, trimmed);
    }
    this.editingConvId.set(null);
    this.editingConvTitle.set('');
  }

  cancelRenameConv(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.editingConvId.set(null);
    this.editingConvTitle.set('');
  }

  onRenameKeydown(conv: Conversation, event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.saveRenameConv(conv, event);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelRenameConv(event);
    }
  }

  promptDeleteActiveMenuConv(event?: MouseEvent): void {
    const conv = this.activeContextMenuConv();
    if (conv) {
      this.promptDeleteConversation(conv, event);
    }
  }

  // --- Photo Upload Modal Delegations ---

  closePhotoUploadModal(): void {
    this.chatState.closePhotoUploadModal();
  }

  toggleUploadRiskBank(key: string): void {
    this.chatState.toggleUploadRiskBank(key);
  }

  selectAllUploadRiskBanks(): void {
    this.chatState.selectAllUploadRiskBanks();
  }

  clearAllUploadRiskBanks(): void {
    this.chatState.clearAllUploadRiskBanks();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.chatState.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.chatState.isDragOver.set(false);
  }

  onDropPhotos(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.chatState.isDragOver.set(false);
    if (event.dataTransfer?.files) {
      void this.chatState.processFiles(event.dataTransfer.files);
    }
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      void this.chatState.processFiles(input.files);
    }
  }

  removeUploadedPhoto(index: number): void {
    this.chatState.removeUploadedPhoto(index);
  }

  clearUploadedPhotos(): void {
    this.chatState.clearUploadedPhotos();
  }

  openManualChecklistFromModal(): void {
    this.chatState.closePhotoUploadModal();
    void this.router.navigate(['/inspection']);
  }

  runAiPhotoAnalysisAndFill(): void {
    this.chatState.runAiPhotoAnalysisAndFill();
    void this.router.navigate(['/chat']);
  }

  // --- Review Drawer Integration ---

  closeReviewDrawer(): void {
    this.chatState.closeReviewDrawer();
  }

  onConfirmAssessment(summary: InspectionDraftSummaryViewModel): void {
    this.chatState.onConfirmAssessment(summary);
  }

  downloadReportPdf(summary: any): void {
    void this.reportService.downloadReportPdf(summary);
  }

  onAssessmentReopened(summary: InspectionDraftSummaryViewModel): void {
    this.chatState.onAssessmentReopened(summary);
  }

  // --- Auth ---

  async logout(): Promise<void> {
    try {
      await this.authService.logout();
    } finally {
      void this.router.navigate(['/login']);
    }
  }
}
