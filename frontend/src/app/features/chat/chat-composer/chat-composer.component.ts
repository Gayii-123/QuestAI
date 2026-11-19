import {
  Component,
  ElementRef,
  ViewChild,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatStateService } from '../../../core/services/chat-state.service';

@Component({
  selector: 'app-chat-composer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-composer.component.html',
  styleUrls: ['./chat-composer.component.css'],
})
export class ChatComposerComponent {
  readonly chatState = inject(ChatStateService);

  @ViewChild('composerTextarea') composerTextarea?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('chatGalleryInput') chatGalleryInput?: ElementRef<HTMLInputElement>;
  @ViewChild('chatCameraInput') chatCameraInput?: ElementRef<HTMLInputElement>;

  onComposerInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.chatState.composerText.set(target.value);
    this.autoGrowComposer(target);
  }

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.chatState.sendMessage();
      if (this.composerTextarea) {
        this.composerTextarea.nativeElement.style.height = 'auto';
      }
    }
  }

  autoGrowComposer(element: HTMLTextAreaElement): void {
    element.style.height = 'auto';
    element.style.height = Math.min(element.scrollHeight, 120) + 'px';
  }

  openGalleryFilePicker(inputEl?: HTMLInputElement): void {
    (inputEl || this.chatGalleryInput?.nativeElement)?.click();
  }

  onComposerFilesSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      void this.chatState.processFiles(target.files);
      target.value = '';
    }
  }

  onComposerCameraCaptured(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      void this.chatState.processFiles(target.files);
      target.value = '';
    }
  }

  removePendingComposerPhoto(index: number): void {
    this.chatState.removeUploadedPhoto(index);
  }

  removeAttachedDocument(): void {
    this.chatState.attachedDocument.set(null);
  }

  onSendClick(): void {
    this.chatState.sendMessage();
    if (this.composerTextarea) {
      this.composerTextarea.nativeElement.style.height = 'auto';
    }
  }

  focus(): void {
    setTimeout(() => {
      this.composerTextarea?.nativeElement.focus();
    }, 50);
  }
}
