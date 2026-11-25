import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  Input,
  Output,
  EventEmitter
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ssra-signature-pad',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ssra-signature-pad.component.html',
  styleUrls: ['./ssra-signature-pad.component.css']
})
export class SsraSignaturePadComponent implements AfterViewInit {
  @ViewChild('signatureCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() title: string = 'Digital Signature';
  @Input() subtitle: string = 'Please draw your signature inside the box below';
  @Input() initialDataUrl?: string;

  @Output() save = new EventEmitter<string>();
  @Output() cancel = new EventEmitter<void>();

  private ctx: CanvasRenderingContext2D | null = null;
  private isDrawing = false;
  hasDrawn = false;

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d');
    this.resizeCanvas();

    if (this.initialDataUrl && this.ctx) {
      const img = new Image();
      img.onload = () => {
        this.ctx?.drawImage(img, 0, 0);
        this.hasDrawn = true;
      };
      img.src = this.initialDataUrl;
    }
  }

  private resizeCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width || 450;
    canvas.height = 200;

    if (this.ctx) {
      this.ctx.lineWidth = 2.5;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.strokeStyle = '#0f172a';
    }
  }

  startDrawing(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    this.isDrawing = true;
    const { x, y } = this.getCoordinates(event);
    if (!this.ctx) return;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
  }

  draw(event: MouseEvent | TouchEvent): void {
    if (!this.isDrawing || !this.ctx) return;
    event.preventDefault();
    const { x, y } = this.getCoordinates(event);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
    this.hasDrawn = true;
  }

  stopDrawing(): void {
    this.isDrawing = false;
  }

  clear(): void {
    const canvas = this.canvasRef.nativeElement;
    if (this.ctx) {
      this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    this.hasDrawn = false;
  }

  saveSignature(): void {
    if (!this.hasDrawn) return;
    const canvas = this.canvasRef.nativeElement;
    const dataUrl = canvas.toDataURL('image/png');
    this.save.emit(dataUrl);
  }

  cancelModal(): void {
    this.cancel.emit();
  }

  private getCoordinates(event: MouseEvent | TouchEvent): { x: number; y: number } {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();

    if ('touches' in event && event.touches.length > 0) {
      return {
        x: event.touches[0].clientX - rect.left,
        y: event.touches[0].clientY - rect.top
      };
    } else if ('clientX' in event) {
      return {
        x: (event as MouseEvent).clientX - rect.left,
        y: (event as MouseEvent).clientY - rect.top
      };
    }
    return { x: 0, y: 0 };
  }
}
